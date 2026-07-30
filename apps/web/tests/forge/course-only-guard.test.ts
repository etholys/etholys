import assert from 'node:assert/strict';
import {
  defaultCourseOnlyHome,
  isApiAllowedForCourseOnlyUser,
  isPageAllowedForCourseOnlyUser,
} from '@/lib/forge/course-only-guard';

const courseId = 'course-expedicion-1';

assert.equal(isPageAllowedForCourseOnlyUser(`/hub/forge/cursos/${courseId}/sala`, [courseId]), true);
assert.equal(isPageAllowedForCourseOnlyUser(`/hub/forge/cursos/${courseId}/mi-mapa`, [courseId]), true);
assert.equal(isPageAllowedForCourseOnlyUser('/hub/forge/mis-cursos', [courseId]), true);
assert.equal(isPageAllowedForCourseOnlyUser('/hub', [courseId]), false);
assert.equal(isPageAllowedForCourseOnlyUser('/hub/nexus', [courseId]), false);
assert.equal(isPageAllowedForCourseOnlyUser('/dashboard', [courseId]), false);
assert.equal(isPageAllowedForCourseOnlyUser('/hub/forge/cursos/other-course/sala', [courseId]), false);
assert.equal(isPageAllowedForCourseOnlyUser('/hub/forge/trilhas', [courseId]), false);
assert.equal(isPageAllowedForCourseOnlyUser('/lab', [courseId]), false);

assert.equal(isApiAllowedForCourseOnlyUser('/api/forge/access-context'), true);
assert.equal(isApiAllowedForCourseOnlyUser('/api/forge/shared-game-rooms/x'), true);
assert.equal(isApiAllowedForCourseOnlyUser('/api/auth/session'), true);
assert.equal(isApiAllowedForCourseOnlyUser('/api/companies'), false);
assert.equal(isApiAllowedForCourseOnlyUser('/api/nexus/foo'), false);
assert.equal(isApiAllowedForCourseOnlyUser('/api/projects'), false);

assert.equal(
  defaultCourseOnlyHome({ allowedCourseIds: [courseId] }),
  `/hub/forge/cursos/${courseId}/sala`
);
assert.equal(defaultCourseOnlyHome({ allowedCourseIds: [courseId, 'b'] }), '/hub/forge/mis-cursos');

console.log('course-only-guard.test.ts: ok');
