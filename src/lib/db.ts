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
}

// Fetch all washing services from services table
export async function getServices(): Promise<Service[]> {
  const { data, error } = await supabase
    .from('services')
    .select('id, name, price')
    .order('id', { ascending: true });

  if (error) {
    console.error('Error fetching services:', error);
    throw error;
  }
  return (data || []).map((s) => ({
    id: s.id,
    name: s.name,
    price: Number(s.price),
  }));
}

// Update a service price in the services table
export async function updateServicePrice(id: number, price: number): Promise<void> {
  const { error } = await supabase
    .from('services')
    .update({ price })
    .eq('id', id);

  if (error) {
    console.error(`Error updating service ${id} price:`, error);
    throw error;
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

// Log a washing job, and link its services
export async function createJob(
  employeeId: string,
  carBrand: string,
  totalAmount: number,
  selectedServices: { serviceId: number; priceCharged: number }[]
): Promise<void> {
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
    throw jobError;
  }

  const jobId = jobData.id;

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
    throw serviceError;
  }
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

// Fetch the 20 most recent jobs and their services
export async function getRecentJobs(): Promise<RecentJobView[]> {
  const { data, error } = await supabase
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
      )
    `)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error fetching recent jobs:', error);
    throw error;
  }

  return (data || []).map((j: any) => {
    const employee_name = j.app_users?.name || 'Unknown Employee';
    const services = (j.job_services || []).map((js: any) => js.services?.name || 'Unknown Service');
    return {
      id: j.id,
      created_at: j.created_at,
      car_brand: j.car_brand,
      total_amount: Number(j.total_amount),
      employee_name,
      services,
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

