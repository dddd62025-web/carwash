import { supabase } from './supabase';

export interface AppUser {
  id: string;
  name: string;
  role: 'owner' | 'employee';
}

export interface Service {
  id: number;
  name: string;
  price: number;
}

export interface Job {
  id: string;
  employee_id: string;
  car_brand: string;
  total_amount: number;
  created_at: string;
}

export interface RecentJobView {
  id: string;
  created_at: string;
  car_brand: string;
  total_amount: number;
  employee_name: string;
  services: string[];
  alert_triggered?: boolean;
  session_id?: string | null;
}

export interface VehicleTypeConfig {
  vehicle_type: string;
  karcher_initial_seconds: number;
  karcher_extension_seconds: number;
  vacuum_initial_seconds: number | null;
  vacuum_extension_seconds: number | null;
}

export interface WashSession {
  id: string;
  bay: number;
  vehicle_type: string;
  job_id: string;
  status: 'active' | 'completed';
  karcher_activation_count: number;
  vacuum_activation_count: number;
  alert_triggered: boolean;
  alert_acknowledged: boolean;
  created_at: string;
  completed_at: string | null;
  car_brand?: string;
  total_amount?: number;
  services_list?: { id: number; name: string; price: number }[];
}

export interface Activation {
  id: string;
  session_id: string;
  resource: 'karcher' | 'vacuum_1' | 'vacuum_2';
  duration_planned_seconds: number;
  start_time: string;
  end_time: string | null;
  sequence_number: number;
}

export interface KarcherLock {
  id: number;
  locked_by_session_id: string | null;
  locked_by_bay: number | null;
  locked_at: string | null;
  expires_at: string | null;
}

const DEFAULT_SERVICES: Service[] = [
  { id: 1, name: 'Lavage extérieur', price: 10.00 },
  { id: 2, name: 'Lavage intérieur', price: 15.00 },
  { id: 3, name: 'Lavage moteur', price: 20.00 },
  { id: 4, name: 'Lavage vapeur', price: 25.00 },
  { id: 5, name: 'Vidange', price: 50.00 },
  { id: 6, name: 'Moto', price: 10.00 },
  { id: 7, name: 'Tapis', price: 5.00 },
  { id: 8, name: 'Tacha', price: 15.00 },
];

// Fetch all washing services from services table
export async function getServices(): Promise<Service[]> {
  const { data, error } = await supabase
    .from('services')
    .select('id, name, price')
    .order('id', { ascending: true });

  if (error) {
    console.error('Error fetching services:', error);
    return DEFAULT_SERVICES;
  }

  const dbServices = data || [];
  const existingMap = new Map(dbServices.map((s) => [s.id, { id: s.id, name: s.name, price: Number(s.price) }]));

  const missingToInsert: Service[] = [];
  const merged = DEFAULT_SERVICES.map((def) => {
    if (existingMap.has(def.id)) {
      return existingMap.get(def.id)!;
    } else {
      missingToInsert.push(def);
      return def;
    }
  });

  dbServices.forEach((s) => {
    if (!DEFAULT_SERVICES.some((d) => d.id === s.id)) {
      merged.push({ id: s.id, name: s.name, price: Number(s.price) });
    }
  });

  if (missingToInsert.length > 0) {
    supabase.from('services').upsert(missingToInsert, { onConflict: 'id' }).then(({ error: upsertErr }) => {
      if (upsertErr) console.warn('Note on auto-seeding missing services:', upsertErr.message);
    });
  }

  return merged.sort((a, b) => a.id - b.id);
}

// Update a service price in the services table
export async function updateServicePrice(id: number, price: number, name?: string): Promise<void> {
  const serviceDef = DEFAULT_SERVICES.find((s) => s.id === id);
  const serviceName = name || serviceDef?.name || `Service #${id}`;

  const { error } = await supabase
    .from('services')
    .upsert({ id, name: serviceName, price }, { onConflict: 'id' });

  if (error) {
    // Fallback to update
    const { error: updateErr } = await supabase
      .from('services')
      .update({ price })
      .eq('id', id);

    if (updateErr) {
      console.error(`Error updating service ${id} price:`, updateErr);
      throw updateErr;
    }
  }
}

// Fetch all registered users
export async function getAppUsers(): Promise<AppUser[]> {
  const { data, error } = await supabase
    .from('app_users')
    .select('id, name, role')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching app users:', error);
    throw error;
  }
  return data as AppUser[];
}

// Log a washing job, and link its services (returns the inserted job object)
export async function createJob(
  employeeId: string,
  carBrand: string,
  totalAmount: number,
  selectedServices: { serviceId: number; priceCharged: number }[]
): Promise<Job> {
  // Insert Job
  const { data: jobData, error: jobError } = await supabase
    .from('jobs')
    .insert({
      employee_id: employeeId,
      car_brand: carBrand,
      total_amount: totalAmount,
    })
    .select()
    .single();

  if (jobError) {
    console.error('Error inserting job:', jobError);
    throw new Error(jobError.message || 'Erreur lors de la création du job.');
  }

  const jobId = jobData.id;

  // Ensure services exist in services table to prevent FK errors
  for (const s of selectedServices) {
    const { error: serviceUpsertErr } = await supabase
      .from('services')
      .upsert(
        { id: s.serviceId, name: carBrand, price: s.priceCharged },
        { onConflict: 'id', ignoreDuplicates: true }
      );
    if (serviceUpsertErr) {
      console.warn('Note on service existence check:', serviceUpsertErr.message);
    }
  }

  // Insert associated services
  const jobServicesToInsert = selectedServices.map((s) => ({
    job_id: jobId,
    service_id: s.serviceId,
    price_charged: s.priceCharged,
  }));

  const { error: serviceError } = await supabase
    .from('job_services')
    .insert(jobServicesToInsert);

  if (serviceError) {
    console.error('Error inserting job services:', serviceError);
    // Cleanup parent job record
    await supabase.from('jobs').delete().eq('id', jobId);
    throw new Error(serviceError.message || 'Erreur lors de la liaison des services.');
  }

  return jobData as Job;
}

// Sum the amount of jobs logged today
export async function getTodayRevenue(): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('jobs')
    .select('total_amount')
    .gte('created_at', startOfDay.toISOString());

  if (error) {
    console.error('Error fetching today revenue:', error);
    throw error;
  }

  return (data || []).reduce((sum, j) => sum + Number(j.total_amount), 0);
}

// Sum the amount of jobs logged in a custom date range
export async function getRevenueInRange(startDate: string, endDate: string): Promise<number> {
  const { data, error } = await supabase
    .from('jobs')
    .select('total_amount')
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  if (error) {
    console.error('Error fetching revenue in range:', error);
    throw error;
  }

  return (data || []).reduce((sum, j) => sum + Number(j.total_amount), 0);
}

// Fetch recent jobs and their services, with optional start and end date filters
export async function getRecentJobs(startDate?: string, endDate?: string): Promise<RecentJobView[]> {
  let query = supabase
    .from('jobs')
    .select(`
      id,
      created_at,
      car_brand,
      total_amount,
      app_users (
        name
      ),
      job_services (
        services (
          name
        )
      ),
      wash_sessions (
        id,
        alert_triggered
      )
    `);

  if (startDate) {
    query = query.gte('created_at', startDate);
  }
  if (endDate) {
    query = query.lte('created_at', endDate);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Error fetching recent jobs:', error);
    throw error;
  }

  return (data || []).map((j: any) => {
    const employee_name = j.app_users?.name || 'Unknown Employee';
    const services = (j.job_services || []).map((js: any) => js.services?.name || 'Unknown Service');
    const session = j.wash_sessions?.[0];
    return {
      id: j.id,
      created_at: j.created_at,
      car_brand: j.car_brand,
      total_amount: Number(j.total_amount),
      employee_name,
      services,
      alert_triggered: session?.alert_triggered || false,
      session_id: session?.id || null
    };
  });
}

// Verify a user's password using pgcrypto crypt
export async function verifyUserPassword(name: string, password: string): Promise<AppUser | null> {
  const { data, error } = await supabase.rpc('verify_user_password', {
    p_name: name,
    p_password: password
  });

  if (error) {
    console.error('Error calling verify_user_password:', error.message, error.details || error.hint || '');
    throw error;
  }

  return data && data.length > 0 ? (data[0] as AppUser) : null;
}

// --- NEW STUFF FOR STATIONS ---

// Fetch configurations for all vehicle types
export async function getVehicleTypeConfigs(): Promise<VehicleTypeConfig[]> {
  const { data, error } = await supabase
    .from('vehicle_type_config')
    .select('*')
    .order('vehicle_type');

  if (error) {
    console.error('Error fetching vehicle type configs:', error);
    throw error;
  }
  return data || [];
}

// Update a configuration for a specific vehicle type
export async function updateVehicleTypeConfig(
  vehicleType: string,
  updates: Partial<VehicleTypeConfig>
): Promise<void> {
  const { error } = await supabase
    .from('vehicle_type_config')
    .update(updates)
    .eq('vehicle_type', vehicleType);

  if (error) {
    console.error(`Error updating vehicle type config ${vehicleType}:`, error);
    throw error;
  }
}

// Fetch all wash sessions that are currently 'active'
export async function getActiveSessions(): Promise<WashSession[]> {
  const { data, error } = await supabase
    .from('wash_sessions')
    .select('*, jobs(car_brand, total_amount, job_services(services(id, name, price)))')
    .eq('status', 'active');

  if (error) {
    console.error('Error fetching active wash sessions:', error);
    throw error;
  }

  return (data || []).map((s: any) => {
    const job = s.jobs;
    const services_list = (job?.job_services || [])
      .map((js: any) => ({
        id: js.services?.id,
        name: js.services?.name || 'Inconnu',
        price: Number(js.services?.price || 0)
      }))
      .filter((srv: any) => srv.id != null);

    return {
      ...s,
      car_brand: job?.car_brand || 'Inconnu',
      total_amount: Number(job?.total_amount || 0),
      services_list
    };
  });
}

// Update services and total_amount for an existing job
export async function updateJobServices(
  jobId: string,
  totalAmount: number,
  selectedServiceIds: number[]
): Promise<void> {
  // Update total_amount in jobs
  const { error: jobErr } = await supabase
    .from('jobs')
    .update({ total_amount: totalAmount })
    .eq('id', jobId);

  if (jobErr) {
    console.error(`Error updating job total amount for ${jobId}:`, jobErr);
    throw jobErr;
  }

  // Delete old job_services
  const { error: delErr } = await supabase
    .from('job_services')
    .delete()
    .eq('job_id', jobId);

  if (delErr) {
    console.error(`Error deleting old job services for ${jobId}:`, delErr);
    throw delErr;
  }

  // Insert new job_services
  if (selectedServiceIds.length > 0) {
    const allServices = await getServices();
    const toInsert = selectedServiceIds.map((sId) => {
      const match = allServices.find((s) => s.id === sId);
      return {
        job_id: jobId,
        service_id: sId,
        price_charged: match ? match.price : 0
      };
    });

    const { error: insErr } = await supabase
      .from('job_services')
      .insert(toInsert);

    if (insErr) {
      console.error(`Error inserting updated job services for ${jobId}:`, insErr);
      throw insErr;
    }
  }
}

// Fetch all wash sessions (all statuses) with alerts
export async function getAllWashSessionsWithAlerts(): Promise<WashSession[]> {
  const { data, error } = await supabase
    .from('wash_sessions')
    .select('*, jobs(car_brand)')
    .eq('alert_triggered', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching sessions with alerts:', error);
    throw error;
  }

  return (data || []).map((s: any) => ({
    ...s,
    car_brand: s.jobs?.car_brand || 'Inconnu'
  }));
}

// Create a new active wash session linked to a job
export async function createWashSession(
  bay: number,
  vehicleType: string,
  jobId: string
): Promise<WashSession> {
  // Ensure vehicle_type_config row exists in DB to prevent foreign key errors
  const defaultConfigMap: Record<string, { k: number; ke: number }> = {
    'Moto': { k: 120, ke: 90 },
    'Tapis': { k: 150, ke: 120 },
    'Tacha': { k: 180, ke: 120 },
    'Petite voiture': { k: 180, ke: 120 },
    'Grande voiture': { k: 240, ke: 180 },
    'Camion': { k: 300, ke: 240 },
  };
  const cfg = defaultConfigMap[vehicleType] || { k: 180, ke: 120 };

  const { error: cfgErr } = await supabase
    .from('vehicle_type_config')
    .upsert({
      vehicle_type: vehicleType,
      karcher_initial_seconds: cfg.k,
      karcher_extension_seconds: cfg.ke,
      vacuum_initial_seconds: null,
      vacuum_extension_seconds: null
    }, { onConflict: 'vehicle_type', ignoreDuplicates: true });

  if (cfgErr) {
    console.warn('Vehicle type config auto-check notice:', cfgErr.message);
  }

  const { data, error } = await supabase
    .from('wash_sessions')
    .insert({
      bay,
      vehicle_type: vehicleType,
      job_id: jobId,
      status: 'active'
    })
    .select()
    .single();

  if (error) {
    console.error('Error inserting wash session:', error);
    throw new Error(error.message || 'Erreur d\'insertion session de lavage.');
  }
  return data as WashSession;
}

// Mark an active session as completed
export async function completeWashSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('wash_sessions')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString()
    })
    .eq('id', sessionId);

  if (error) {
    console.error(`Error completing wash session ${sessionId}:`, error);
    throw error;
  }
}

// Get the shared Karcher lock state
export async function getKarcherLock(): Promise<KarcherLock | null> {
  const { data, error } = await supabase
    .from('karcher_lock')
    .select('*')
    .eq('id', 1)
    .single();

  if (error) {
    console.error('Error fetching Karcher lock status:', error);
    throw error;
  }
  return data as KarcherLock;
}

// Request Kärcher routing to a specific bay via RPC
export async function requestKarcherRouting(bay: number, sessionId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('request_karcher_routing', {
    p_bay: bay,
    p_session_id: sessionId
  });

  if (error) {
    console.error(`Error requesting Kärcher routing for bay ${bay}:`, error);
    throw error;
  }
  return !!data;
}

// Fetch detailed activations list for a given wash session
export async function getActivationsForSession(sessionId: string): Promise<Activation[]> {
  const { data, error } = await supabase
    .from('activations')
    .select('*')
    .eq('session_id', sessionId)
    .order('sequence_number', { ascending: true });

  if (error) {
    console.error(`Error fetching activations for session ${sessionId}:`, error);
    throw error;
  }
  return data || [];
}

// Acknowledge a triggered alert on a completed session
export async function acknowledgeAlert(sessionId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('acknowledge_alert', {
    p_session_id: sessionId
  });

  if (error) {
    console.error(`Error acknowledging alert for session ${sessionId}:`, error);
    throw error;
  }
  return !!data;
}
