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

-- 5.1 request_activation
CREATE OR REPLACE FUNCTION request_activation(p_bay INT, p_resource TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session RECORD;
    v_mapped_resource TEXT;
    v_lock_session_id UUID;
    v_lock_bay INT;
    v_lock_expires TIMESTAMPTZ;
    v_seq_num INT;
    v_duration INT;
    v_activation_id UUID;
    v_karcher_count INT;
    v_vacuum_count INT;
    v_alert_triggered BOOLEAN;
    v_config RECORD;
BEGIN
    -- Obtenir la session active pour ce poste
    SELECT * INTO v_session
    FROM wash_sessions
    WHERE bay = p_bay AND status = 'active'
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'no_active_session');
    END IF;

    -- Mapper la ressource et valider selon le poste
    IF p_resource = 'karcher' THEN
        v_mapped_resource := 'karcher';
    ELSIF p_resource = 'vacuum' THEN
        IF p_bay = 1 THEN
            v_mapped_resource := 'vacuum_1';
        ELSIF p_bay = 2 THEN
            v_mapped_resource := 'vacuum_2';
        ELSE
            RETURN jsonb_build_object('allowed', false, 'reason', 'vacuum_not_available_on_bay_3');
        END IF;
    ELSE
        RETURN jsonb_build_object('allowed', false, 'reason', 'invalid_resource');
    END IF;

    -- Vérifier s'il y a déjà une activation en cours pour cette ressource dans cette session
    PERFORM 1
    FROM activations
    WHERE session_id = v_session.id AND resource = v_mapped_resource AND end_time IS NULL;

    IF FOUND THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'already_running');
    END IF;

    -- Gérer le verrou Kärcher
    IF v_mapped_resource = 'karcher' THEN
        SELECT locked_by_session_id, locked_by_bay, expires_at 
        INTO v_lock_session_id, v_lock_bay, v_lock_expires
        FROM karcher_lock
        WHERE id = 1;

        -- Si occupé par une autre session et non expiré
        IF v_lock_session_id IS NOT NULL AND v_lock_session_id <> v_session.id AND v_lock_expires > now() THEN
            RETURN jsonb_build_object('allowed', false, 'reason', 'occupied', 'locked_by_bay', v_lock_bay);
        END IF;
    END IF;

    -- Calculer le numéro de séquence
    SELECT COUNT(*) INTO v_seq_num
    FROM activations
    WHERE session_id = v_session.id AND resource = v_mapped_resource;
    v_seq_num := v_seq_num + 1;

    -- Récupérer la configuration de durée
    SELECT * INTO v_config
    FROM vehicle_type_config
    WHERE vehicle_type = v_session.vehicle_type;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'missing_vehicle_type_config');
    END IF;

    -- Appliquer la durée (impair -> initial_seconds, pair -> extension_seconds)
    IF v_mapped_resource = 'karcher' THEN
        IF v_seq_num % 2 = 1 THEN
            v_duration := v_config.karcher_initial_seconds;
        ELSE
            v_duration := v_config.karcher_extension_seconds;
        END IF;
    ELSE
        IF v_seq_num % 2 = 1 THEN
            v_duration := v_config.vacuum_initial_seconds;
        ELSE
            v_duration := v_config.vacuum_extension_seconds;
        END IF;
    END IF;

    IF v_duration IS NULL THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'resource_not_supported_for_vehicle_type');
    END IF;

    -- Insérer l'activation
    INSERT INTO activations (session_id, resource, duration_planned_seconds, start_time, end_time, sequence_number)
    VALUES (v_session.id, v_mapped_resource, v_duration, now(), NULL, v_seq_num)
    RETURNING id INTO v_activation_id;

    -- Verrouiller la ressource si Kärcher
    IF v_mapped_resource = 'karcher' THEN
        UPDATE karcher_lock
        SET locked_by_session_id = v_session.id,
            locked_by_bay = p_bay,
            locked_at = now(),
            expires_at = now() + (v_duration || ' seconds')::INTERVAL + INTERVAL '60 seconds'
        WHERE id = 1;
    END IF;

    -- Incrémenter les compteurs de session et évaluer les seuils d'alerte
    v_alert_triggered := v_session.alert_triggered;
    IF v_mapped_resource = 'karcher' THEN
        v_karcher_count := v_session.karcher_activation_count + 1;
        v_vacuum_count := v_session.vacuum_activation_count;
        IF v_karcher_count >= 5 THEN
            v_alert_triggered := true;
        END IF;
    ELSE
        v_karcher_count := v_session.karcher_activation_count;
        v_vacuum_count := v_session.vacuum_activation_count + 1;
        IF v_vacuum_count >= 3 THEN
            v_alert_triggered := true;
        END IF;
    END IF;

    UPDATE wash_sessions
    SET karcher_activation_count = v_karcher_count,
        vacuum_activation_count = v_vacuum_count,
        alert_triggered = v_alert_triggered
    WHERE id = v_session.id;

    RETURN jsonb_build_object(
        'allowed', true,
        'duration_seconds', v_duration,
        'activation_id', v_activation_id
    );
END;
$$;

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
        SET expires_at = now() + INTERVAL '60 seconds'
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

-- 5.5 acknowledge_alert
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

    IF v_session.status <> 'completed' THEN
        RAISE EXCEPTION 'La session doit être terminée (status = completed) pour pouvoir être acquittée.';
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
GRANT EXECUTE ON FUNCTION request_activation(INT, TEXT) TO public;
GRANT EXECUTE ON FUNCTION end_activation(UUID) TO public;
GRANT EXECUTE ON FUNCTION heartbeat_activation(UUID) TO public;
GRANT EXECUTE ON FUNCTION expire_stuck_locks() TO public;
GRANT EXECUTE ON FUNCTION acknowledge_alert(UUID) TO public;

-- 7. Insertion des Données de Référence (Seeds)
-- Rétablir les 5 prestations de lavage standard
INSERT INTO services (id, name, price)
VALUES
    (1, 'Lavage extérieur', 10.00),
    (2, 'Lavage intérieur', 15.00),
    (3, 'Lavage moteur', 20.00),
    (4, 'Lavage vapeur', 25.00),
    (5, 'Vidange', 50.00)
ON CONFLICT (id) DO NOTHING;

-- Rétablir les comptes opérateurs (avec hachage de mot de passe crypté pgcrypto)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO app_users (id, name, role, password_hash)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'Kais', 'employee', crypt('employee123', gen_salt('bf'))),
    ('22222222-2222-2222-2222-222222222222', 'Amine', 'employee', crypt('employee123', gen_salt('bf'))),
    ('44444444-4444-4444-4444-444444444444', 'Issam', 'owner', crypt('issam123', gen_salt('bf')))
ON CONFLICT (id) DO NOTHING;

