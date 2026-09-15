import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { AppDataSource } from '../data-source';
import { User } from '../entities';

/**
 * Recovery hatch for when nobody can get into the system.
 *
 * Resets the Super Admin to a known password and clears any lockout, or
 * recreates the account if it is gone. The account is flagged to force a new
 * personal password at next login, so this temporary password never sticks.
 */
async function resetAdmin() {
  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(User);

  let admin = await repo.findOne({ where: { email: 'admin@jericho.rw' } });

  const NEW_PASSWORD = 'Admin@Jericho2025!';
  const hash = await bcrypt.hash(NEW_PASSWORD, 10);

  if (admin) {
    admin.password = hash;
    admin.must_change_password = true;
    admin.failed_login_attempts = 0;
    admin.locked_until = null;
    admin.status = 'active';
    await repo.save(admin);
    console.log('✓ Super Admin password reset successfully');
  } else {
    admin = repo.create({
      name: 'Super Admin',
      email: 'admin@jericho.rw',
      password: hash,
      role: 'super_admin',
      must_change_password: true,
      status: 'active',
    });
    await repo.save(admin);
    console.log('✓ Super Admin created fresh');
  }

  console.log('');
  console.log('  Email:    admin@jericho.rw');
  console.log(`  Password: ${NEW_PASSWORD}`);
  console.log('  → You will be asked to set a new personal password on first login.');
  console.log('');

  await AppDataSource.destroy();
}

resetAdmin().catch((e) => { console.error(e); process.exit(1); });
