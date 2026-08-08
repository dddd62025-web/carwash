const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xlvnjueaiwiqkejsnodg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhsdm5qdWVhaXdpcWtlanNub2RnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3ODY1NTcsImV4cCI6MjA5OTM2MjU1N30.T1gotW1V-izEqahhC-PG68ltSTz-svH6Xf0aPGC4isg';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// bcrypt hashes for:
// employee123 = '$2a$06$nErinK1Gm6X7gR3W0IMcH.9gYCNXID3gTXKS8suY3HWzhMmxRdoDe'
// issam123 = '$2a$06$mF0XraxeLBvxDCbwec5Fl.djt.4zBwrmSH84kzTsT2JEeAyfUfQ3W'

async function reseed() {
  console.log('--- Reseeding Database ---');

  const services = [
    { id: 1, name: 'Lavage extérieur', price: 10.00 },
    { id: 2, name: 'Lavage intérieur', price: 15.00 },
    { id: 3, name: 'Lavage moteur', price: 20.00 },
    { id: 4, name: 'Lavage vapeur', price: 25.00 },
    { id: 5, name: 'Vidange', price: 50.00 }
  ];

  console.log('Inserting services...');
  const { error: sErr } = await supabase
    .from('services')
    .upsert(services, { onConflict: 'id' });

  if (sErr) console.error('Services seed error:', sErr);
  else console.log('✅ Services seeded successfully.');

  const users = [
    { 
      id: '11111111-1111-1111-1111-111111111111', 
      name: 'Kais', 
      role: 'employee',
      password_hash: '$2a$06$nErinK1Gm6X7gR3W0IMcH.9gYCNXID3gTXKS8suY3HWzhMmxRdoDe'
    },
    { 
      id: '22222222-2222-2222-2222-222222222222', 
      name: 'Amine', 
      role: 'employee',
      password_hash: '$2a$06$nErinK1Gm6X7gR3W0IMcH.9gYCNXID3gTXKS8suY3HWzhMmxRdoDe'
    },
    { 
      id: '33333333-3333-3333-3333-333333333333', 
      name: 'Employé', 
      role: 'employee',
      password_hash: '$2a$06$nErinK1Gm6X7gR3W0IMcH.9gYCNXID3gTXKS8suY3HWzhMmxRdoDe'
    },
    { 
      id: '44444444-4444-4444-4444-444444444444', 
      name: 'Issam', 
      role: 'owner',
      password_hash: '$2a$06$mF0XraxeLBvxDCbwec5Fl.djt.4zBwrmSH84kzTsT2JEeAyfUfQ3W'
    }
  ];

  console.log('Inserting app users...');
  const { error: uErr } = await supabase
    .from('app_users')
    .upsert(users, { onConflict: 'id' });

  if (uErr) console.error('Users seed error:', uErr);
  else console.log('✅ App users seeded successfully.');

  console.log('--- Reseeding Complete ---');
}

reseed();
