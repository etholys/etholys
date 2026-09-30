import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { defaultMilestones, newFundTask, parseFundTasks } from '@/lib/opportunity/fund-tasks';

describe('fund-tasks', () => {
  it('seeds default milestones with submit due on deadline', () => {
    const tasks = defaultMilestones('es', '2026-12-01');
    assert.equal(tasks.length, 5);
    assert.equal(tasks[4].id, 'ms_submit');
    assert.equal(tasks[4].dueAt, '2026-12-01');
  });

  it('parses and creates tasks', () => {
    const t = newFundTask('Revisar LOI', '2026-10-01');
    assert.equal(t.done, false);
    const parsed = parseFundTasks([{ id: t.id, title: t.title, done: true, dueAt: t.dueAt }]);
    assert.equal(parsed[0].done, true);
  });
});
