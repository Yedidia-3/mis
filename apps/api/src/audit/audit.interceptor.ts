import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';

// Maps a finished mutating request to a human-readable audit entry, so the
// log captures "everything" (created class, submitted attendance, …) without
// instrumenting each service by hand.
interface RouteRule {
  method: string;
  // path matcher against the request path (with /api/v1 prefix stripped)
  test: RegExp;
  action: string;
  details: (ctx: { params: any; body: any; path: string }) => string;
}

const RULES: RouteRule[] = [
  // Auth / profile
  { method: 'POST', test: /^\/auth\/login$/, action: 'Signed in', details: () => 'Signed in to the system' },
  { method: 'POST', test: /^\/auth\/change-password$/, action: 'Changed password', details: () => 'Changed own password' },
  { method: 'PUT',  test: /^\/auth\/profile$/, action: 'Updated profile', details: (c) => c.body?.name ? `Updated profile (name: ${c.body.name})` : 'Updated profile / photo' },

  // Super admin — users & years
  { method: 'POST', test: /^\/admin\/users$/, action: 'Created user', details: (c) => `Created ${c.body?.role ?? 'user'} account: ${c.body?.name ?? ''}`.trim() },
  { method: 'PUT',  test: /^\/admin\/users\/\d+$/, action: 'Updated user', details: (c) => `Updated user details${c.body?.name ? `: ${c.body.name}` : ''}${c.body?.email ? ` (${c.body.email})` : ''}` },
  { method: 'DELETE', test: /^\/admin\/users\/\d+$/, action: 'Deleted user', details: (c) => `Deleted user #${c.params?.id}` },
  { method: 'POST', test: /^\/admin\/users\/\d+\/reset-password$/, action: 'Reset password', details: (c) => `Reset password for user #${c.params?.id}` },
  { method: 'POST', test: /^\/admin\/academic-years$/, action: 'Created academic year', details: (c) => `Created academic year ${c.body?.name ?? ''}`.trim() },
  { method: 'POST', test: /^\/admin\/academic-years\/\d+\/archive$/, action: 'Archived academic year', details: (c) => `Archived academic year #${c.params?.id}` },
  { method: 'POST', test: /^\/admin\/academic-years\/\d+\/request-deletion$/, action: 'Requested year deletion', details: (c) => `Requested deletion of academic year #${c.params?.id}` },
  { method: 'POST', test: /^\/admin\/academic-years\/\d+\/(approve|reject)-deletion$/, action: 'Reviewed year deletion', details: (c) => `${c.path.endsWith('approve-deletion') ? 'Approved' : 'Rejected'} deletion of academic year #${c.params?.id}` },

  // Academics — p-levels, classes, students
  { method: 'POST', test: /^\/academics\/p-levels$/, action: 'Created P-Level', details: (c) => `Created P-Level ${c.body?.name ?? ''}`.trim() },
  { method: 'DELETE', test: /^\/academics\/p-levels\/\d+$/, action: 'Deleted P-Level', details: (c) => `Deleted P-Level #${c.params?.id}` },
  { method: 'POST', test: /^\/academics\/p-levels\/\d+\/import$/, action: 'Imported students', details: (c) => `Imported students into P-Level #${c.params?.id}` },
  { method: 'POST', test: /^\/academics\/classes$/, action: 'Created class', details: (c) => `Created class ${c.body?.name ?? ''}`.trim() },
  { method: 'DELETE', test: /^\/academics\/classes\/\d+$/, action: 'Deleted class', details: (c) => `Deleted class #${c.params?.id}` },
  { method: 'PUT',  test: /^\/academics\/classes\/\d+\/assign-teacher$/, action: 'Assigned teacher', details: (c) => `Assigned teacher to class #${c.params?.id}` },
  { method: 'PUT',  test: /^\/academics\/students\/\d+\/move$/, action: 'Moved student', details: (c) => `Moved student #${c.params?.id} to another class` },

  // Attendance
  { method: 'POST', test: /^\/academics\/classes\/\d+\/attendance$/, action: 'Submitted attendance', details: (c) => `Submitted attendance for class #${c.params?.id}` },
  { method: 'POST', test: /^\/academics\/classes\/\d+\/attendance\/reset$/, action: 'Reset attendance', details: (c) => `Reset attendance for class #${c.params?.id}` },

  // Shuffle workflow
  { method: 'POST', test: /^\/academics\/shuffle\/run$/, action: 'Ran shuffle', details: (c) => `Ran ${String(c.body?.algorithm ?? '').replace(/_/g, ' ')} shuffle for P-Level #${c.body?.p_level_id}` },
  { method: 'POST', test: /^\/academics\/shuffle\/\d+\/submit$/, action: 'Submitted class list', details: (c) => `Submitted class list (session #${c.params?.sessionId}) for approval` },
  { method: 'POST', test: /^\/academics\/shuffle\/\d+\/approve$/, action: 'Approved class list', details: (c) => `Approved class list (session #${c.params?.sessionId})` },
  { method: 'POST', test: /^\/academics\/shuffle\/\d+\/reject$/, action: 'Rejected class list', details: (c) => `Rejected class list (session #${c.params?.sessionId})${c.body?.note ? `: ${c.body.note}` : ''}` },
  { method: 'POST', test: /^\/academics\/shuffle\/\d+\/distribute$/, action: 'Distributed class list', details: (c) => `Distributed class list (session #${c.params?.sessionId})` },

  // Accountant — enrollments & zones
  { method: 'POST', test: /^\/accountant\/enrollments$/, action: 'Created enrollment', details: () => 'Created an enrollment' },
  { method: 'POST', test: /^\/accountant\/enrollments\/bulk$/, action: 'Imported enrollments', details: (c) => `Imported ${c.body?.student_ids?.length ?? 0} students into ${c.body?.type ?? 'a service'}` },
  { method: 'DELETE', test: /^\/accountant\/enrollments\/by-student\/\d+$/, action: 'Waived enrollment', details: (c) => `Waived student #${c.params?.studentId} from a service` },
  { method: 'PUT',  test: /^\/accountant\/enrollments\/\d+\/payments$/, action: 'Recorded payment', details: (c) => `Updated payments for enrollment #${c.params?.id}` },
  { method: 'PUT',  test: /^\/accountant\/enrollments\/\d+\/zone$/, action: 'Set transport zone', details: (c) => `Set zone for enrollment #${c.params?.id}` },
  { method: 'POST', test: /^\/accountant\/zones$/, action: 'Created zone', details: (c) => `Created zone ${c.body?.name ?? ''}`.trim() },
  { method: 'PUT',  test: /^\/accountant\/zones\/\d+$/, action: 'Updated zone', details: (c) => `Updated zone #${c.params?.id}` },
  { method: 'DELETE', test: /^\/accountant\/zones\/\d+$/, action: 'Deleted zone', details: (c) => `Deleted zone #${c.params?.id}` },
];

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const method: string = req.method;

    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    // strip /api/v1 prefix
    const rawPath: string = (req.path || req.url || '').split('?')[0];
    const path = rawPath.replace(/^\/api\/v1/, '');

    const rule = RULES.find((r) => r.method === method && r.test.test(path));

    return next.handle().pipe(
      tap(() => {
        // Only log on success (tap runs after the handler resolves)
        const user = req.user; // full User entity from JwtStrategy (may be undefined for login)
        const ctx = { params: req.params ?? {}, body: req.body ?? {}, path };
        const action = rule ? rule.action : `${method} ${path}`;
        const details = rule ? safe(() => rule.details(ctx)) : '';
        const ip = (req.headers?.['x-forwarded-for'] || req.ip || '').toString().split(',')[0] || '—';

        // For login, the actor comes from the response/body email (no req.user yet)
        const actorName = user?.name || req.body?.email || 'System';
        const actorRole = user?.role || (path === '/auth/login' ? 'user' : 'system');

        this.audit.log({
          actor_id: user?.id,
          actor_name: actorName,
          actor_role: actorRole,
          action,
          details,
          ip_address: ip,
        });
      }),
    );
  }
}

function safe(fn: () => string): string {
  try { return fn(); } catch { return ''; }
}
