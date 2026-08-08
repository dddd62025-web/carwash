const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xlvnjueaiwiqkejsnodg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhsdm5qdWVhaXdpcWtlanNub2RnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3ODY1NTcsImV4cCI6MjA5OTM2MjU1N30.T1gotW1V-izEqahhC-PG68ltSTz-svH6Xf0aPGC4isg';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
  console.log('Testing App Users...');
  const { data: users, error: usersError } = await supabase
    .from('app_users')
    .select('id, name, role');
  
  if (usersError) {
    console.error('Users fetch error:', usersError);
  } else {
    console.log('Users retrieved:', users);
  }

  console.log('Testing Services...');
  const { data: services, error: servicesError } = await supabase
    .from('services')
    .select('id, name, price');

  if (servicesError) {
    console.error('Services fetch error:', servicesError);
  } else {
    console.log('Services retrieved:', services);
  }
}

testConnection();
