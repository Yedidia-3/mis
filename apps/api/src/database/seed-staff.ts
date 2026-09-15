/**
 * Seed script — creates the 32 staff members for the test branch.
 *
 * Data issues noted in the source list (not silently fixed — flagged below):
 *   - S013 and S027 share the same email. S027 gets a placeholder.
 *   - S003 and S029 share the same email. S029 gets a placeholder.
 *   - S031 email domain is @72gmail.com — kept as-is, flagged.
 *   - S032 phone has 13 digits — phone is not stored, so no impact.
 *   - S006, S012, S016 emails were cropped in source — kept best-guess values.
 *   - S014 role is Head Teacher → mapped to teacher (no head-teacher role exists).
 *   - S016 role is Accountant.
 *   - S001 role is DOS (Director of Studies) → mapped to dean.
 *
 * Run from apps/api/:
 *   npx ts-node -r tsconfig-paths/register src/database/seed-staff.ts
 */

import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { AppDataSource } from '../data-source';
import { User } from '../entities';

// ── Helpers ───────────────────────────────────────────────────────────────────

function tempPassword(): string {
  const upper   = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower   = 'abcdefghjkmnpqrstuvwxyz';
  const digits  = '23456789';
  const special = '@#!$';
  const rand = (s: string) => s[Math.floor(Math.random() * s.length)];
  const pwd =
    rand(upper) + rand(upper) +
    rand(lower) + rand(lower) + rand(lower) +
    rand(digits) + rand(digits) +
    rand(special);
  return pwd.split('').sort(() => 0.5 - Math.random()).join('');
}

// ── Staff list ────────────────────────────────────────────────────────────────

const STAFF: { id: string; name: string; email: string; role: 'dean' | 'teacher' | 'accountant'; note?: string }[] = [
  { id: 'S001', name: 'BIMENYIMANA Audace',          email: 'audacebimenyimana@gmail.com',              role: 'dean',      note: 'DOS → mapped to dean' },
  { id: 'S002', name: 'Innocent NSHIMIYIMANA',        email: 'innocentnshimiyimana22@gmail.com',         role: 'teacher' },
  { id: 'S003', name: 'TUZUSENGE Zabulon',            email: 'tuzusengezabulon35@gmail.com',             role: 'teacher' },
  { id: 'S004', name: 'Telesphore NSHIMIYIMANA',      email: 'nshimatelesphor@gmail.com',                role: 'teacher' },
  { id: 'S005', name: 'Nzayisenga Alexis',            email: 'nzayisengalexis13@gmail.com',              role: 'teacher' },
  { id: 'S006', name: 'René MUNEZERO',                email: 'hitmakerminsparapluiemrumbrell@gmail.com', role: 'teacher',   note: 'Email was cropped in source — verify' },
  { id: 'S007', name: 'Mathieu NDIZIHIWE',            email: 'mathindizi5@gmail.com',                    role: 'teacher' },
  { id: 'S008', name: 'IRAGI BISIMWA JUDITH',         email: 'judithbisimwa16@gmail.com',                role: 'teacher' },
  { id: 'S009', name: 'BABONANGENDA Jean Bosco',      email: 'babobosco7@gmail.com',                     role: 'teacher' },
  { id: 'S010', name: 'Jean Claude NIYONSABA',        email: 'niyonsabajeanclaude1996@gmail.com',        role: 'teacher' },
  { id: 'S011', name: 'INGABIRE Claire',              email: 'ingabireclaire60@gmail.com',               role: 'teacher' },
  { id: 'S012', name: 'WILLIAM NKORERIMANA',          email: 'nkorerimanawilliam@gmail.com',             role: 'teacher',   note: 'Email was cropped in source — verify' },
  { id: 'S013', name: 'Nkurunziza Jean de Dieu',      email: 'jeandedieunkurunziza039@gmail.com',        role: 'teacher' },
  { id: 'S014', name: 'MUKARUGWIRO Christine',        email: 'mukarugwiro1@gmail.com',                   role: 'teacher',   note: 'Head Teacher → mapped to teacher' },
  { id: 'S015', name: 'Uwayisaba Dan Léon Pasteur',   email: 'kaburamepauline@gmail.com',                role: 'teacher' },
  { id: 'S016', name: 'MUKESHIMANA Espérance',        email: 'esperance.mukeshagashugi@gmail.com',       role: 'accountant', note: 'Email was cropped in source — verify' },
  { id: 'S017', name: 'NYIRANSABIMANA Beata',         email: 'beatanyiransabimana7@gmail.com',           role: 'teacher' },
  { id: 'S018', name: 'Ruzindana Philippe',           email: 'philiruzindana@gmail.com',                 role: 'teacher' },
  { id: 'S019', name: 'Mberamiheto Daniel',           email: 'mberamihetodaniel@gmail.com',              role: 'teacher' },
  { id: 'S020', name: 'Gahutu Emmanuel',              email: 'gahutuemmanuel2@gmail.com',                role: 'teacher' },
  { id: 'S021', name: 'Nkurunziza Anaclet',           email: 'anacletnkurunziza717@gmail.com',           role: 'teacher' },
  { id: 'S022', name: 'Habanabasindi Anselme',        email: 'ahabanabasindi@gmail.com',                 role: 'teacher' },
  { id: 'S023', name: 'MUKANDANGA Emeline',           email: 'emelinemukandanga@gmail.com',              role: 'teacher' },
  { id: 'S024', name: 'Nizigiyimana Gaudence',        email: 'gaudencenizigiyimana2@gmail.com',          role: 'teacher' },
  { id: 'S025', name: 'Kwizera Pascaline',            email: 'kwizerapascaline592@gmail.com',            role: 'teacher' },
  { id: 'S026', name: 'UWERA Marie Rose',             email: 'lilikuku32@gmail.com',                     role: 'teacher' },
  { id: 'S027', name: 'UWAMARIYA Julienne',           email: 'jeandedieunkurunziza039b@gmail.com',        role: 'teacher',   note: 'Duplicate email with S013 — B suffix added for test' },
  { id: 'S028', name: 'NIYORUREMA Phelin',            email: 'niyoruremaphelin@gmail.com',               role: 'teacher' },
  { id: 'S029', name: 'NIRINGIYIMANA Jean Baptist',   email: 'tuzusengezabulon35b@gmail.com',             role: 'teacher',   note: 'Duplicate email with S003 — B suffix added for test' },
  { id: 'S030', name: 'HAKIZAMUNGU Ildephonse',       email: 'ildephonsehitamungu@gmail.com',            role: 'teacher' },
  { id: 'S031', name: 'UMUTESI Florence',             email: 'umutesiFlorence@72gmail.com',              role: 'teacher',   note: 'Domain @72gmail.com looks wrong — verify' },
  { id: 'S032', name: 'ABAYISENGA Dieudonne',         email: 'abayisengadieudonne162@gmail.com',         role: 'teacher',   note: 'Phone 0735340540549 has 13 digits — not stored, but worth checking' },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  await AppDataSource.initialize();
  const userRepo = AppDataSource.getRepository(User);

  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log('  Jericho School — Staff Seed (test branch)');
  console.log('══════════════════════════════════════════════════════════════════\n');

  const results: { id: string; name: string; email: string; role: string; password: string; status: string; note?: string }[] = [];

  for (const s of STAFF) {
    const existing = await userRepo.findOne({ where: { email: s.email } });
    if (existing) {
      results.push({ ...s, password: '(already exists — skipped)', status: 'SKIPPED' });
      continue;
    }

    const pwd = tempPassword();
    const hash = await bcrypt.hash(pwd, 10);
    await userRepo.save(
      userRepo.create({
        name: s.name,
        email: s.email,
        role: s.role as any,
        password: hash,
        must_change_password: true,
      }),
    );
    results.push({ ...s, password: pwd, status: 'CREATED' });
  }

  // ── Print credentials table ───────────────────────────────────────────────
  console.log('Staff ID  Status   Role        Email                                          Temp Password   Notes');
  console.log('────────  ───────  ──────────  ─────────────────────────────────────────────  ──────────────  ─────');
  for (const r of results) {
    const note = r.note ?? '';
    console.log(
      `${r.id.padEnd(8)}  ${r.status.padEnd(7)}  ${r.role.padEnd(10)}  ${r.email.padEnd(45)}  ${r.password.padEnd(14)}  ${note}`,
    );
  }

  const created = results.filter((r) => r.status === 'CREATED').length;
  const skipped = results.filter((r) => r.status === 'SKIPPED').length;
  console.log(`\n✓ ${created} created, ${skipped} skipped (already existed)`);

  console.log('\n⚠  Data issues to resolve before going live:');
  console.log('   S027 UWAMARIYA Julienne   — placeholder email, real email duplicates S013');
  console.log('   S029 NIRINGIYIMANA Jean B — placeholder email, real email duplicates S003');
  console.log('   S031 UMUTESI Florence     — email domain @72gmail.com, likely @gmail.com');
  console.log('   S006 René MUNEZERO        — email was cropped in source, verify');
  console.log('   S012 WILLIAM NKORERIMANA  — email was cropped in source, verify');
  console.log('   S016 MUKESHIMANA Espérance — email was cropped in source, verify\n');

  await AppDataSource.destroy();
}

run().catch((e) => { console.error(e); process.exit(1); });
