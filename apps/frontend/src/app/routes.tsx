import { createBrowserRouter, Navigate } from "react-router";
import { AuthLayout } from "./layouts/AuthLayout";
import { AppError } from "./screens/shared/AppError";
import { ChangePasswordScreen } from "./screens/shared/ChangePasswordScreen";
import { LoginScreen } from "./screens/shared/LoginScreen";
import { NotFoundScreen } from "./screens/shared/NotFoundScreen";
import { NotificationCenter } from "./screens/shared/NotificationCenter";
import { ProfileSettings } from "./screens/shared/ProfileSettings";
import { UnauthorizedScreen } from "./screens/shared/UnauthorizedScreen";

// Super Admin screens
import { AcademicYearManagement } from "./screens/super-admin/AcademicYearManagement";
import { AuditLog } from "./screens/super-admin/AuditLog";
import { SuperAdminDashboard } from "./screens/super-admin/SuperAdminDashboard";
import { UserManagement } from "./screens/super-admin/UserManagement";

// Dean screens
import { AlgorithmSelection } from "./screens/dean/AlgorithmSelection";
import { ClassManagement } from "./screens/dean/ClassManagement";
import { DeanDashboard } from "./screens/dean/DeanDashboard";
import { DistributionList } from "./screens/dean/DistributionList";
import { DistributionScreen } from "./screens/dean/DistributionScreen";
import { ExcelImport } from "./screens/dean/ExcelImport";
import { PLevelManagement } from "./screens/dean/PLevelManagement";
import { PreviewTable } from "./screens/dean/PreviewTable";

// Principal screens
import { PendingApprovals } from "./screens/principal/PendingApprovals";
import { PrincipalDashboard } from "./screens/principal/PrincipalDashboard";
import { ShuffleReview } from "./screens/principal/ShuffleReview";

// Teacher screens
import { AttendanceHistory } from "./screens/teacher/AttendanceHistory";
import { AttendanceScreen } from "./screens/teacher/AttendanceScreen";
import { MyClasses } from "./screens/teacher/MyClasses";
import { MyClassStudentList } from "./screens/teacher/MyClassStudentList";
import { TeacherDashboard } from "./screens/teacher/TeacherDashboard";
import { CourseCatalogue } from "./screens/dean/CourseCatalogue";

// Accountant screens
import { AccountantDashboard } from "./screens/accountant/AccountantDashboard";
import { ClassListsSelector } from "./screens/accountant/ClassListsSelector";
import { CommuniqueGenerator } from "./screens/accountant/CommuniqueGenerator";
import { EnrollmentServiceSelector } from "./screens/accountant/EnrollmentServiceSelector";
import { FeedingEnrollment } from "./screens/accountant/FeedingEnrollment";
import { StudentListPerClass } from "./screens/accountant/StudentListPerClass";
import { TransportEnrollment } from "./screens/accountant/TransportEnrollment";
import { ZoneManagement } from "./screens/accountant/ZoneManagement";

export const router = createBrowserRouter([
  {
    path: "/login",
    Component: LoginScreen,
    ErrorBoundary: AppError,
  },
  {
    path: "/change-password",
    Component: ChangePasswordScreen,
    ErrorBoundary: AppError,
  },
  {
    path: "/",
    Component: AuthLayout,
    ErrorBoundary: AppError,
    children: [
      {
        index: true,
        element: <Navigate to="/login" replace />,
      },
      // Super Admin routes
      {
        path: "admin/dashboard",
        Component: SuperAdminDashboard,
      },
      {
        path: "admin/users",
        Component: UserManagement,
      },
      {
        path: "admin/audit-log",
        Component: AuditLog,
      },
      {
        path: "admin/academic-year",
        Component: AcademicYearManagement,
      },

      // Dean routes
      {
        path: "dean/dashboard",
        Component: DeanDashboard,
      },
      {
        path: "dean/p-levels",
        Component: PLevelManagement,
      },
      {
        path: "dean/p-levels/:pLevelId/classes",
        Component: ClassManagement,
      },
      {
        path: "dean/import",
        Component: ExcelImport,
      },
      {
        path: "dean/algorithm/:pLevelId",
        Component: AlgorithmSelection,
      },
      {
        path: "dean/preview/:sessionId",
        Component: PreviewTable,
      },
      {
        path: "dean/distribution",
        Component: DistributionList,
      },
      {
        path: "dean/distribute/:sessionId",
        Component: DistributionScreen,
      },
      // Principal routes
      {
        path: "principal/dashboard",
        Component: PrincipalDashboard,
      },
      {
        path: "principal/approvals",
        Component: PendingApprovals,
      },
      {
        path: "principal/review/:sessionId",
        Component: ShuffleReview,
      },
      {
        path: "principal/p-levels",
        Component: PLevelManagement,
      },
      {
        path: "principal/p-levels/:pLevelId/classes",
        Component: ClassManagement,
      },
      // Teacher routes
      {
        path: "teacher/dashboard",
        Component: TeacherDashboard,
      },
      {
        path: "teacher/my-classes",
        Component: MyClasses,
      },
      {
        path: "teacher/class/:classId",
        Component: MyClassStudentList,
      },
      {
        path: "teacher/class/:classId/attendance",
        Component: AttendanceScreen,
      },
      {
        path: "teacher/attendance-history",
        Component: AttendanceHistory,
      },
      {
        path: "dean/courses",
        Component: CourseCatalogue,
      },

      // Accountant routes
      {
        path: "accountant/dashboard",
        Component: AccountantDashboard,
      },
      {
        path: "accountant/class-lists",
        Component: ClassListsSelector,
      },
      {
        path: "accountant/class-lists/:pLevelId",
        Component: StudentListPerClass,
      },
      {
        path: "accountant/enrollment",
        Component: EnrollmentServiceSelector,
      },
      {
        path: "accountant/enrollment/feeding",
        Component: FeedingEnrollment,
      },
      {
        path: "accountant/enrollment/transport",
        Component: TransportEnrollment,
      },
      {
        path: "accountant/zones",
        Component: ZoneManagement,
      },
      {
        path: "accountant/communique",
        Component: CommuniqueGenerator,
      },

      // Shared routes
      {
        path: "profile",
        Component: ProfileSettings,
      },
      {
        path: "notifications",
        Component: NotificationCenter,
      },
      {
        path: "403",
        Component: UnauthorizedScreen,
      },
      {
        path: "*",
        Component: NotFoundScreen,
      },
    ],
  },
]);
