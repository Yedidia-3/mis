import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { AppDataSource } from '../data-source';
import { User } from '../entities';

/**
 * Seeds the one account the system bootstraps with: the Super Admin.
 *
 * Run `npm run migration:run` first — this script expects the schema to exist
 * and will not create it. Every other user is created from inside the app by
 * the Super Admin, so this stays deliberately minimal.
 */
async function seed() {
  await AppDataSource.initialize();
  console.log('Connected to database');

  const userRepo = AppDataSource.getRepository(User);

  const existing = await userRepo.findOne({ where: { email: 'admin@jericho.rw' } });
  if (!existing) {
    const hash = await bcrypt.hash('Admin@Jericho2025!', 10);
    await userRepo.save(userRepo.create({
      name: 'Super Admin',
      email: 'admin@jericho.rw',
      password: hash,
      role: 'super_admin',
      must_change_password: true, // Must set personal password on first login
    }));
    console.log('✓ Super Admin created');
    console.log('  Email:    admin@jericho.rw');
    console.log('  Password: Admin@Jericho2025!');
    console.log('  → Will be forced to set a personal password on first login.');
  } else {
    console.log('✓ Super Admin already exists');
  }

  console.log('\nSeed complete. All other users must be created by the Super Admin.');
  await AppDataSource.destroy();
}

seed().catch((e) => { console.error(e); process.exit(1); });
