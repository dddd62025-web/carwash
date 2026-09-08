-- 0. Table des badges RFID autorisés
CREATE TABLE IF NOT EXISTS authorized_tags (
    id SERIAL PRIMARY KEY,
    tag_uid TEXT UNIQUE NOT NULL,
    label TEXT DEFAULT 'Badge Autorisé',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed badges RFID autorisés
INSERT INTO authorized_tags (tag_uid, label) VALUES
    ('C13696A3', 'Badge RFID 1'),
    ('97308005', 'Badge RFID 2'),
    ('92896A06', 'Badge RFID 3'),
    ('CE887F05', 'Badge RFID 4'),
    ('F11871A3', 'Badge RFID 5'),
    ('5432F106', 'Badge RFID 6')
ON CONFLICT (tag_uid) DO UPDATE SET is_active = true;

-- 1. Table configuration par type de véhicule
CREATE TABLE IF NOT EXISTS vehicle_type_config (
    vehicle_type TEXT PRIMARY KEY,
    karcher_initial_seconds INT NOT NULL,
    karcher_extension_seconds INT NOT NULL,
    vacuum_initial_seconds INT NULL,
    vacuum_extension_seconds INT NULL
);

-- Seed configurations initiales par défaut
INSERT INTO vehicle_type_config (vehicle_type, karcher_initial_seconds, karcher_extension_seconds, vacuum_initial_seconds, vacuum_extension_seconds)
VALUES
    ('Petite voiture', 180, 120, 180, 120),
    ('Grande voiture', 240, 180, 240, 180),
    ('Camion', 300, 240, 300, 240),
    ('Moto', 120, 90, NULL, NULL),
    ('Tapis', 150, 120, NULL, NULL),
    ('Tacha', 180, 120, NULL, NULL)
ON CONFLICT (vehicle_type) DO UPDATE SET
    karcher_initial_seconds = EXCLUDED.karcher_initial_seconds,
    karcher_extension_seconds = EXCLUDED.karcher_extension_seconds,
    vacuum_initial_seconds = EXCLUDED.vacuum_initial_seconds,
    vacuum_extension_seconds = EXCLUDED.vacuum_extension_seconds;

-- 2. Table des sessions de lavage (un véhicule en cours de traitement sur un poste)
CREATE TABLE IF NOT EXISTS wash_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bay INT NOT NULL CHECK (bay IN (1, 2, 3)),
    vehicle_type TEXT NOT NULL REFERENCES vehicle_type_config(vehicle_type),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('active', 'completed')),
    karcher_activation_count INT NOT NULL DEFAULT 0,
    vacuum_activation_count INT NOT NULL DEFAULT 0,
    alert_triggered BOOLEAN NOT NULL DEFAULT false,
    alert_acknowledged BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ NULL
);

-- 3. Table des activations physiques détaillées
CREATE TABLE IF NOT EXISTS activations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES wash_sessions(id) ON DELETE CASCADE,
    resource TEXT NOT NULL CHECK (resource IN ('karcher', 'vacuum_1', 'vacuum_2')),
    duration_planned_seconds INT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    end_time TIMESTAMPTZ NULL,
    sequence_number INT NOT NULL
);

-- 4. Table du verrou de la ressource partagée Kärcher (toujours 1 seule ligne)
CREATE TABLE IF NOT EXISTS karcher_lock (
    id INT PRIMARY KEY CHECK (id = 1),
    locked_by_session_id UUID NULL REFERENCES wash_sessions(id) ON DELETE SET NULL,
    locked_by_bay INT NULL CHECK (locked_by_bay IN (1, 2, 3)),
    locked_at TIMESTAMPTZ NULL,
    expires_at TIMESTAMPTZ NULL
);

-- Initialise la ligne de verrou unique
INSERT INTO karcher_lock (id, locked_by_session_id, locked_by_bay, locked_at, expires_at)
VALUES (1, NULL, NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- 5. Fonctions stockées PL/pgSQL (RPC)

-- 5.1 request_activation avec vérification du badge RFID
CREATE OR REPLACE FUNCTION request_activation(p_bay int, p_resource text, p_tag_uid text)
RETURNS json AS $$
DECLARE
  v_session         wash_sessions%ROWTYPE;
  v_config          vehicle_type_config%ROWTYPE;
  v_lock            karcher_lock%ROWTYPE;
  v_tag_valid       boolean;
  v_already_running boolean;
  v_seq             int;
  v_duration        int;
  v_activation_id   uuid;
BEGIN
  -- 1. Vérification du badge en premier
  SELECT EXISTS(
    SELECT 1 FROM authorized_tags
    WHERE tag_uid = p_tag_uid AND is_active = true
  ) INTO v_tag_valid;

  IF NOT v_tag_valid THEN
    RETURN json_build_object('allowed', false, 'reason', 'unauthorized_tag');
  END IF;

  -- 2. Session active sur ce poste ?
  SELECT * INTO v_session FROM wash_sessions
  WHERE bay = p_bay AND status = 'active'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('allowed', false, 'reason', 'no_active_session');
  END IF;

  -- 3. Un timer est-il déjà en cours pour cette ressource sur cette session ?
  SELECT EXISTS(
    SELECT 1 FROM activations
    WHERE session_id = v_session.id AND resource = p_resource AND end_time IS NULL
  ) INTO v_already_running;

  IF v_already_running THEN
    RETURN json_build_object('allowed', false, 'reason', 'already_running');
  END IF;

  -- 4. Verrou spécifique au Kärcher : verrouille la ligne pour éviter une course
  IF p_resource = 'karcher' THEN
    SELECT * INTO v_lock FROM karcher_lock WHERE id = 1 FOR UPDATE;

    IF v_lock.locked_by_session_id IS NOT NULL
       AND v_lock.locked_by_session_id != v_session.id THEN
      RETURN json_build_object('allowed', false, 'reason', 'occupied');
    END IF;
  END IF;

  -- 5. Numéro de séquence pour l'alternance initial/extension
  SELECT COUNT(*) + 1 INTO v_seq
  FROM activations
  WHERE session_id = v_session.id AND resource = p_resource;

  -- 6. Configuration du temps pour ce type de véhicule
  SELECT * INTO v_config FROM vehicle_type_config
  WHERE vehicle_type = v_session.vehicle_type;

  IF NOT FOUND THEN
    RETURN json_build_object('allowed', false, 'reason', 'missing_vehicle_config');
  END IF;

  -- 7. Alternance : impair -> initial, pair -> extension
  IF p_resource = 'karcher' THEN
    v_duration := CASE WHEN v_seq % 2 = 1
      THEN v_config.karcher_initial_seconds
      ELSE v_config.karcher_extension_seconds
    END;
  ELSE
    v_duration := CASE WHEN v_seq % 2 = 1
      THEN v_config.vacuum_initial_seconds
      ELSE v_config.vacuum_extension_seconds
    END;
  END IF;

  IF v_duration IS NULL THEN
    RETURN json_build_object('allowed', false, 'reason', 'resource_not_available_for_bay');
  END IF;

  -- 8. Enregistrement de l'activation (start_time généré par le serveur)
  INSERT INTO activations (session_id, resource, duration_planned_seconds, sequence_number, start_time)
  VALUES (v_session.id, p_resource, v_duration, v_seq, now())
  RETURNING id INTO v_activation_id;

  -- 9. Compteurs et seuils d'alerte (Kärcher: 5e activation, Aspirateur: 3e)
  IF p_resource = 'karcher' THEN
    UPDATE wash_sessions SET karcher_activation_count = v_seq WHERE id = v_session.id;
    IF v_seq >= 5 THEN
      UPDATE wash_sessions SET alert_triggered = true WHERE id = v_session.id;
    END IF;

    UPDATE karcher_lock
    SET locked_by_session_id = v_session.id,
        locked_by_bay = p_bay,
        locked_at = now(),
        expires_at = now() + ((v_duration + 60) * interval '1 second')
    WHERE id = 1;
  ELSE
    UPDATE wash_sessions SET vacuum_activation_count = v_seq WHERE id = v_session.id;
    IF v_seq >= 3 THEN
      UPDATE wash_sessions SET alert_triggered = true WHERE id = v_session.id;
    END IF;
  END IF;

  RETURN json_build_object(
    'allowed', true,
    'duration_seconds', v_duration,
    'activation_id', v_activation_id,
    'reason', null
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5.2 end_activation
CREATE OR REPLACE FUNCTION end_activation(p_activation_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_activation RECORD;
BEGIN
    SELECT * INTO v_activation
    FROM activations
    WHERE id = p_activation_id;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    UPDATE activations
    SET end_time = now()
    WHERE id = p_activation_id;

    IF v_activation.resource = 'karcher' THEN
        UPDATE karcher_lock
        SET locked_by_session_id = NULL,
            locked_by_bay = NULL,
            locked_at = NULL,
            expires_at = NULL
        WHERE locked_by_session_id = v_activation.session_id;
    END IF;

    RETURN true;
END;
$$;

-- 5.3 heartbeat_activation
CREATE OR REPLACE FUNCTION heartbeat_activation(p_activation_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_activation RECORD;
BEGIN
    SELECT * INTO v_activation
    FROM activations
    WHERE id = p_activation_id AND end_time IS NULL;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    IF v_activation.resource = 'karcher' THEN
        UPDATE karcher_lock
        SET expires_at = GREATEST(
            now() + INTERVAL '30 seconds',
            v_activation.start_time + (v_activation.duration_planned_seconds * INTERVAL '1 second')
        )
        WHERE locked_by_session_id = v_activation.session_id;
    END IF;

    RETURN true;
END;
$$;

-- 5.4 expire_stuck_locks
CREATE OR REPLACE FUNCTION expire_stuck_locks()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_lock RECORD;
    v_released INT := 0;
BEGIN
    SELECT * INTO v_lock
    FROM karcher_lock
    WHERE id = 1 AND locked_by_session_id IS NOT NULL AND expires_at <= now();

    IF FOUND THEN
        -- Terminer l'activation en cours liée à cette session expirée
        UPDATE activations
        SET end_time = now()
        WHERE session_id = v_lock.locked_by_session_id AND resource = 'karcher' AND end_time IS NULL;

        -- Libérer le verrou
        UPDATE karcher_lock
        SET locked_by_session_id = NULL,
            locked_by_bay = NULL,
            locked_at = NULL,
            expires_at = NULL
        WHERE id = 1;

        v_released := 1;
    END IF;

    RETURN v_released;
END;
$$;

-- 5.5 request_karcher_routing
CREATE OR REPLACE FUNCTION request_karcher_routing(p_bay INT, p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lock        RECORD;
  v_session     RECORD;
  v_has_active  BOOLEAN;
  v_duration    INT;
BEGIN
  -- Get current lock state
  SELECT * INTO v_lock FROM karcher_lock WHERE id = 1;

  -- Check if badge is actively tagged for the lock holder
  IF v_lock.locked_by_session_id IS NOT NULL
     AND v_lock.locked_by_session_id <> p_session_id
  THEN
    SELECT EXISTS (
      SELECT 1 FROM activations
      WHERE session_id = v_lock.locked_by_session_id
        AND resource = 'karcher'
        AND end_time IS NULL
    ) INTO v_has_active;

    -- Badge is tagged on another post -> refuse
    IF v_has_active THEN
      RETURN false;
    END IF;
  END IF;

  -- Get the requesting session's vehicle type
  SELECT * INTO v_session FROM wash_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RETURN false; END IF;

  -- Get duration from vehicle_type_config
  SELECT karcher_initial_seconds INTO v_duration
  FROM vehicle_type_config
  WHERE vehicle_type = v_session.vehicle_type;

  -- Fallback to 60s if config is missing
  IF v_duration IS NULL THEN v_duration := 60; END IF;

  -- Acquire lock
  UPDATE karcher_lock
  SET locked_by_session_id = p_session_id,
      locked_by_bay        = p_bay,
      locked_at            = now(),
      expires_at           = now() + (v_duration || ' seconds')::INTERVAL
  WHERE id = 1;

  RETURN true;
END;
$$;

-- 5.6 acknowledge_alert
CREATE OR REPLACE FUNCTION acknowledge_alert(p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session RECORD;
BEGIN
    SELECT * INTO v_session
    FROM wash_sessions
    WHERE id = p_session_id;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    UPDATE wash_sessions
    SET alert_acknowledged = true
    WHERE id = p_session_id;

    RETURN true;
END;
$$;

-- 6. RLS & Permissions
ALTER TABLE vehicle_type_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE wash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE karcher_lock ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes politiques si existantes
DROP POLICY IF EXISTS select_all_vehicle_type_config ON vehicle_type_config;
DROP POLICY IF EXISTS select_all_wash_sessions ON wash_sessions;
DROP POLICY IF EXISTS select_all_activations ON activations;
DROP POLICY IF EXISTS select_all_karcher_lock ON karcher_lock;
DROP POLICY IF EXISTS insert_wash_sessions ON wash_sessions;
DROP POLICY IF EXISTS update_wash_sessions ON wash_sessions;
DROP POLICY IF EXISTS modify_vehicle_type_config ON vehicle_type_config;

-- Politiques de lecture publique
CREATE POLICY select_all_vehicle_type_config ON vehicle_type_config FOR SELECT TO public USING (true);
CREATE POLICY select_all_wash_sessions ON wash_sessions FOR SELECT TO public USING (true);
CREATE POLICY select_all_activations ON activations FOR SELECT TO public USING (true);
CREATE POLICY select_all_karcher_lock ON karcher_lock FOR SELECT TO public USING (true);

-- Politiques d'écriture pour les utilisateurs connectés
CREATE POLICY insert_wash_sessions ON wash_sessions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY update_wash_sessions ON wash_sessions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY modify_vehicle_type_config ON vehicle_type_config FOR ALL TO authenticated USING (true);

-- Accorder le droit d'exécution sur les fonctions RPC à public
GRANT EXECUTE ON FUNCTION request_activation(INT, TEXT, TEXT) TO public;
GRANT EXECUTE ON FUNCTION end_activation(UUID) TO public;
GRANT EXECUTE ON FUNCTION heartbeat_activation(UUID) TO public;
GRANT EXECUTE ON FUNCTION expire_stuck_locks() TO public;
GRANT EXECUTE ON FUNCTION request_karcher_routing(INT, UUID) TO public;
GRANT EXECUTE ON FUNCTION acknowledge_alert(UUID) TO public;

-- 7. Insertion des Données de Référence (Seeds)
-- Rétablir les prestations de lavage standard
INSERT INTO services (id, name, price)
VALUES
    (1, 'Lavage extérieur', 10.00),
    (2, 'Lavage intérieur', 15.00),
    (3, 'Lavage moteur', 20.00),
    (4, 'Lavage vapeur', 25.00),
    (5, 'Vidange', 50.00),
    (6, 'Moto', 10.00),
    (7, 'Tapis', 5.00),
    (8, 'Tacha', 15.00)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    price = EXCLUDED.price;

-- Rétablir les comptes opérateurs (avec hachage bcrypt)
INSERT INTO app_users (id, name, role, password_hash)
VALUES
    ('33333333-3333-3333-3333-333333333333', 'Employé', 'employee', '$2a$06$nErinK1Gm6X7gR3W0IMcH.9gYCNXID3gTXKS8suY3HWzhMmxRdoDe'),
    ('44444444-4444-4444-4444-444444444444', 'Issam', 'owner', '$2a$06$mF0XraxeLBvxDCbwec5Fl.djt.4zBwrmSH84kzTsT2JEeAyfUfQ3W')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    password_hash = EXCLUDED.password_hash;

