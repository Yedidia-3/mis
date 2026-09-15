import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Class } from '../../entities/class.entity';
import { PLevel } from '../../entities/p-level.entity';
import { ShuffleResult } from '../../entities/shuffle-result.entity';
import { ShuffleSession } from '../../entities/shuffle-session.entity';
import { Student } from '../../entities/student.entity';
import { User } from '../../entities/user.entity';
import { NotificationsService } from '../../notifications/notifications.service';
import { RunShuffleDto } from './dto/run-shuffle.dto';
import { applyAlgorithm as runShuffleAlgorithm } from './shuffle-algorithms';

@Injectable()
export class ShuffleService {
  constructor(
    @InjectRepository(ShuffleSession) private sessionRepo: Repository<ShuffleSession>,
    @InjectRepository(ShuffleResult) private resultRepo: Repository<ShuffleResult>,
    @InjectRepository(Student) private studentRepo: Repository<Student>,
    @InjectRepository(Class) private classRepo: Repository<Class>,
    @InjectRepository(PLevel) private pLevelRepo: Repository<PLevel>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private notificationsService: NotificationsService,
  ) {}

  async runShuffle(dto: RunShuffleDto, submittedBy: number) {
    // Step 1: get the active classes for this p-level (same query as the count endpoint)
    const pLevelClasses = await this.classRepo.find({
      where: { p_level_id: dto.p_level_id, status: 'active' },
      order: { name: 'ASC' },
    });

    if (!pLevelClasses.length) {
      throw new BadRequestException('No classes found for this P-level. Please create classes or import students first.');
    }

    const classIds = pLevelClasses.map((c) => c.id);

    // Step 2: load students using direct column comparison (same approach as student-count endpoint)
    const students = await this.studentRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.current_class', 'c')
      .where('s.current_class_id IN (:...ids)', { ids: classIds })
      .andWhere('s.academic_year_id = :yid', { yid: dto.academic_year_id })
      // Ordered by mark, best first. Rank is recorded per class on import, so
      // ordering a whole P-level by it would equate "1st in P4A" with "1st in
      // P4C"; a mark is comparable across classes. A missing mark counts as
      // zero and therefore sorts last. Rank and id only break ties, keeping
      // the result reproducible.
      .orderBy('COALESCE(s.marks_percentage, 0)', 'DESC')
      .addOrderBy('s.rank', 'ASC', 'NULLS LAST')
      .addOrderBy('c.name', 'ASC')
      .addOrderBy('s.id', 'ASC')
      .getMany();

    if (!students.length) {
      throw new BadRequestException('No students found for this P-level. Please import students first.');
    }

    // Target classes = same p-level's classes (shuffle redistributes within P1 A/B/C)
    const targetClasses = pLevelClasses;

    // For auto_promote with 1 class, just map 1:1
    const classCount = targetClasses.length || 1;

    // Create shuffle session
    const session = this.sessionRepo.create({
      academic_year_id: dto.academic_year_id,
      p_level_id: dto.p_level_id,
      algorithm: dto.algorithm as any,
      status: 'in_progress',
      submitted_by: submittedBy,
    });
    const savedSession = await this.sessionRepo.save(session);

    // Delete existing results for this session
    await this.resultRepo.delete({ shuffle_session_id: savedSession.id });

    // Run the algorithm
    const assignments = this.applyAlgorithm(dto.algorithm, students, targetClasses);

    // Persist results
    const results = assignments.map(({ student, classObj }) =>
      this.resultRepo.create({
        shuffle_session_id: savedSession.id,
        student_id: student.id,
        proposed_class_id: classObj.id,
        is_manual_override: false,
      }),
    );
    await this.resultRepo.save(results);

    return this.getPreview(savedSession.id);
  }

  private applyAlgorithm(algorithm: string, students: Student[], classes: Class[]) {
    // Nothing to redistribute into — everyone keeps their current class.
    if (!classes.length) return students.map((s) => ({ student: s, classObj: s.current_class }));

    // Marks drive every algorithm. A student with no mark recorded counts as
    // zero, by the school's rule — which places them in the weakest group, so
    // getPreview reports who they are for the dean to check before approving.
    const marked = students.map((student) => ({
      student,
      mark: Number(student.marks_percentage ?? 0),
    }));

    // The algorithms themselves live in ./shuffle-algorithms as pure functions
    // so they can be unit-tested without a database.
    return runShuffleAlgorithm(algorithm, marked, classes);
  }

  async getPreview(sessionId: number) {
    // Load session by itself (no relation — avoids TypeORM relation bugs)
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Shuffle session not found');

    // Load p_level directly using its own repo (100% reliable)
    const pLevel = await this.pLevelRepo.findOne({ where: { id: session.p_level_id } });
    const pLevelName = pLevel?.name ?? '';

    // Load classes directly (used for the id→name map returned to frontend)
    const pLevelClasses = await this.classRepo.find({
      where: { p_level_id: session.p_level_id, status: 'active' },
      order: { name: 'ASC' },
    });
    const classes = pLevelClasses.map((c) => ({
      id: c.id,
      name: `${pLevelName}${c.name}`,
      teacher_id: c.teacher_id,
      distributed_at: c.distributed_at,
      is_served: !!c.teacher_id && !!c.distributed_at,
    }));

    // Raw SQL — bypasses all TypeORM relation-mapping ambiguities completely.
    // We join shuffle_results → students → classes manually and map to shape.
    const rawRows: {
      result_id: number;
      student_id: number;
      proposed_class_id: number;
      is_manual_override: boolean;
      student_name: string;
      former_class: string | null;
      rank: number | null;
      marks_percentage: number | null;
      sc_name: string | null;   // student's current class name
      pc_name: string;           // proposed class name
    }[] = await this.resultRepo.query(
      `SELECT
         r.id              AS result_id,
         r.student_id,
         r.proposed_class_id,
         r.is_manual_override,
         s.name            AS student_name,
         s.former_class,
         s.rank,
         s.marks_percentage,
         sc.name           AS sc_name,
         pc.name           AS pc_name
       FROM shuffle_results r
       JOIN students   s  ON s.id  = r.student_id
       JOIN classes    pc ON pc.id = r.proposed_class_id
       LEFT JOIN classes sc ON sc.id = s.current_class_id
       WHERE r.shuffle_session_id = $1
       ORDER BY r.proposed_class_id ASC`,
      [sessionId],
    );

    const grouped: Record<string, any[]> = {};
    for (const r of rawRows) {
      const label = `${pLevelName}${r.pc_name ?? ''}`;
      if (!label.trim()) continue;
      if (!grouped[label]) grouped[label] = [];
      grouped[label].push({
        result_id: r.result_id,
        student_id: r.student_id,
        name: r.student_name ?? '—',
        former_class: r.former_class ?? r.sc_name ?? '—',
        rank: r.rank,
        marks_percentage: r.marks_percentage,
        new_class: label,
        new_class_id: r.proposed_class_id,
        is_manual_override: r.is_manual_override,
      });
    }

    // Each class's resulting average is what "balanced" actually delivered.
    // The principal approving a shuffle should be able to check it rather than
    // take the word on trust.
    const summary = Object.entries(grouped).map(([label, rows]) => {
      const marks = rows.map((r) => Number(r.marks_percentage ?? 0));
      const total = marks.reduce((sum, m) => sum + m, 0);
      return {
        class: label,
        count: rows.length,
        average_mark: rows.length ? Math.round((total / rows.length) * 100) / 100 : null,
      };
    });

    // Students with no mark recorded were treated as scoring zero, which is
    // what pushed them into the weakest group. That is a data-entry gap
    // producing an academic outcome, so it is surfaced for the dean to check
    // before anyone approves the result.
    const unmarked = rawRows
      .filter((r) => r.marks_percentage === null || r.marks_percentage === undefined)
      .map((r) => ({
        student_id: r.student_id,
        name: r.student_name ?? '—',
        former_class: r.former_class ?? r.sc_name ?? '—',
        proposed_class: `${pLevelName}${r.pc_name ?? ''}`,
      }));

    const averages = summary.map((s) => s.average_mark).filter((a): a is number => a !== null);
    const balance = {
      // How far apart the strongest and weakest classes ended up.
      spread: averages.length ? Math.round((Math.max(...averages) - Math.min(...averages)) * 100) / 100 : null,
      unmarked_count: unmarked.length,
    };

    // Attach pLevel to session object so the frontend interface stays intact
    const sessionOut = { ...session, p_level: pLevel };

    return { session: sessionOut, grouped, summary, classes, unmarked, balance };
  }

  async adjustStudent(sessionId: number, resultId: number, newClassId: number) {
    const result = await this.resultRepo.findOne({ where: { id: resultId, shuffle_session_id: sessionId } });
    if (!result) throw new NotFoundException('Result not found');
    result.proposed_class_id = newClassId;
    result.is_manual_override = true;
    await this.resultRepo.save(result);
    return this.getPreview(sessionId);
  }

  // Previously this routed the session to the Principal for approval. The
  // school's workflow has changed so that a Dean's submission is treated as
  // approved immediately and can be distributed without Principal
  // intervention. This method now marks the session `approved` and records
  // the dean as the reviewer.
  async submitForApproval(sessionId: number, deanId: number, _principalId?: number) {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found');
    if (session.status !== 'in_progress') throw new BadRequestException('Session is not in progress');

    session.status = 'approved';
    session.submitted_at = new Date();
    session.reviewed_by = deanId;
    session.reviewed_at = new Date();
    await this.sessionRepo.save(session);

    await this.notificationsService.notify(
      deanId,
      `Your class list submission (Session #${sessionId}) has been auto-approved and is ready for distribution.`,
      'success',
    );

    return { message: 'Submitted and auto-approved' };
  }

  async approve(sessionId: number, principalId: number, deanId: number) {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found');
    if (session.status !== 'pending_approval') throw new BadRequestException('Session is not pending approval');

    session.status = 'approved';
    session.reviewed_by = principalId;
    session.reviewed_at = new Date();
    await this.sessionRepo.save(session);

    await this.notificationsService.notify(
      deanId,
      `Class list for Session #${sessionId} has been approved. Ready for distribution.`,
      'success',
    );

    return { message: 'Approved successfully' };
  }

  async reject(sessionId: number, principalId: number, deanId: number, note: string) {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found');
    if (session.status !== 'pending_approval') throw new BadRequestException('Session is not pending approval');

    session.status = 'rejected';
    session.reviewed_by = principalId;
    session.reviewed_at = new Date();
    session.rejection_note = note;
    await this.sessionRepo.save(session);

    await this.notificationsService.notify(
      deanId,
      `Class list for Session #${sessionId} was rejected. Note: ${note}. Please review and resubmit.`,
      'error',
    );

    return { message: 'Rejected and Dean notified' };
  }

  async distribute(sessionId: number, deanId: number, seniorStaffId: number, teacherAssignments: { class_id: number; teacher_id: number }[]) {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found');

    const allowedStatuses = ['approved', 'distributed'];
    if (!allowedStatuses.includes(session.status)) {
      throw new BadRequestException('Session must be approved before distribution');
    }

    const pLevelClasses = await this.classRepo.find({
      where: { p_level_id: session.p_level_id, status: 'active' },
      order: { name: 'ASC' },
    });
    const fullyServed = pLevelClasses.length > 0 && pLevelClasses.every((cls) => !!cls.distributed_at && !!cls.teacher_id);
    if (session.status === 'distributed' && fullyServed) {
      throw new BadRequestException('This class list has already been distributed to all assigned recipients.');
    }

    const results: { student_id: number; proposed_class_id: number }[] =
      await this.resultRepo.query(
        `SELECT student_id, proposed_class_id FROM shuffle_results WHERE shuffle_session_id = $1`,
        [sessionId],
      );

    if (!results.length) {
      throw new BadRequestException('No class distribution data found for this session');
    }

    const now = new Date();

    for (const r of results) {
      await this.studentRepo.update(r.student_id, {
        current_class_id: r.proposed_class_id,
        status: 'promoted',
      });
    }

    const distributedClassIds = [...new Set(results.map((r) => r.proposed_class_id))];
    for (const cid of distributedClassIds) {
      await this.classRepo.update(cid, { distributed_at: now });
    }

    for (const ta of teacherAssignments) {
      if (ta.class_id && ta.teacher_id) {
        await this.classRepo.update(ta.class_id, { teacher_id: ta.teacher_id });
      }
    }

    session.status = 'distributed';
    session.distributed_at = now;
    await this.sessionRepo.save(session);

    if (seniorStaffId) {
      const user = await this.userRepo.findOne({ where: { id: seniorStaffId } });
      const label = user ? `${user.role === 'principal' ? 'Principal' : 'Accountant'} ${user.name}` : 'Senior staff member';
      await this.notificationsService.notify(
        seniorStaffId,
        `${label} has been assigned the ${session.p_level_id ? 'new class list' : 'distributed class list'} for review.`,
        'success',
      );
    }

    for (const ta of teacherAssignments) {
      if (!ta.teacher_id) continue;
      const cls = await this.classRepo.findOne({ where: { id: ta.class_id }, relations: ['p_level'] });
      const label = cls ? `${cls.p_level?.name ?? ''}${cls.name}` : 'your class';
      await this.notificationsService.notify(
        ta.teacher_id,
        `Your new class list for ${label} is ready in your portal.`,
        'success',
      );
    }

    return { message: 'Distributed successfully', distributed_classes: distributedClassIds.length };
  }

  async getPendingApprovals() {
    // Raw SQL for reliability (TypeORM relation loading is flaky on this schema)
    const rows = await this.sessionRepo.query(
      `SELECT ss.id, ss.status, ss.algorithm, ss.p_level_id,
              ss.submitted_at, ss.reviewed_at, ss.distributed_at, ss.rejection_note,
              pl.name AS p_level_name,
              u.name  AS submitted_by_name,
              (SELECT COUNT(*) FROM shuffle_results r WHERE r.shuffle_session_id = ss.id) AS student_count
       FROM shuffle_sessions ss
       JOIN p_levels pl ON pl.id = ss.p_level_id
       LEFT JOIN users u ON u.id = ss.submitted_by
       WHERE ss.status = 'pending_approval'
         AND ss.academic_year_id = (SELECT id FROM academic_years WHERE status = 'active' ORDER BY created_at DESC LIMIT 1)
       ORDER BY ss.submitted_at ASC`,
    );
    return rows.map(this.mapSessionRow);
  }

  // Dean's Distribution module — only the LATEST session per P-Level, so a
  // re-run after a rejection supersedes the old bar instead of stacking up.
  async getDeanSessions() {
    const rows = await this.sessionRepo.query(
      `SELECT * FROM (
         SELECT DISTINCT ON (ss.p_level_id)
                ss.id, ss.status, ss.algorithm, ss.p_level_id,
                ss.submitted_at, ss.reviewed_at, ss.distributed_at, ss.rejection_note,
                ss.created_at, ss.updated_at,
                pl.name AS p_level_name,
                u.name  AS submitted_by_name,
                (SELECT COUNT(*) FROM shuffle_results r WHERE r.shuffle_session_id = ss.id) AS student_count
         FROM shuffle_sessions ss
         JOIN p_levels pl ON pl.id = ss.p_level_id
         LEFT JOIN users u ON u.id = ss.submitted_by
         WHERE ss.academic_year_id = (SELECT id FROM academic_years WHERE status = 'active' ORDER BY created_at DESC LIMIT 1)
         ORDER BY ss.p_level_id, ss.created_at DESC
       ) latest
       ORDER BY latest.updated_at DESC`,
    );
    return rows.map(this.mapSessionRow);
  }

  private mapSessionRow = (r: any) => ({
    id: r.id,
    status: r.status,
    algorithm: r.algorithm,
    p_level: { id: r.p_level_id, name: r.p_level_name },
    submitted_by_name: r.submitted_by_name,
    student_count: Number(r.student_count ?? 0),
    submitted_at: r.submitted_at,
    reviewed_at: r.reviewed_at,
    distributed_at: r.distributed_at,
    rejection_note: r.rejection_note,
  });
}
