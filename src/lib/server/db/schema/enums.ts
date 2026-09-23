import { pgEnum } from 'drizzle-orm/pg-core';

export const levelEnum = pgEnum('learner_level', ['beginner', 'intermediate', 'advanced']);
export const learningStyleEnum = pgEnum('learning_style', ['reading', 'video', 'hands_on', 'mixed']);
export const goalStatusEnum = pgEnum('goal_status', ['active', 'paused', 'completed', 'archived']);
export const roadmapStatusEnum = pgEnum('roadmap_status', ['generating', 'ready', 'failed', 'archived']);
export const topicStatusEnum = pgEnum('topic_status', ['not_started', 'in_progress', 'completed']);
export const resourceTypeEnum = pgEnum('resource_type', [
	'documentation',
	'tutorial',
	'course',
	'video',
	'interactive',
	'book',
	'project',
	'exercise',
	'article'
]);
export const resourceCostEnum = pgEnum('resource_cost', ['free', 'freemium', 'paid']);
export const resourceRoleEnum = pgEnum('resource_role', ['primary', 'alternative', 'practice', 'project']);
export const savedStatusEnum = pgEnum('saved_status', ['saved', 'in_progress', 'done']);
export const sessionKindEnum = pgEnum('session_kind', ['learn', 'practice', 'assess', 'revise', 'project']);
export const planStatusEnum = pgEnum('plan_status', ['active', 'completed', 'partial', 'missed']);
export const planItemStatusEnum = pgEnum('plan_item_status', ['pending', 'done', 'skipped']);
export const planItemKindEnum = pgEnum('plan_item_kind', ['learn', 'practice', 'assess', 'revise', 'project', 'carry_over']);
export const completionEnum = pgEnum('plan_completion', ['yes', 'partly', 'no']);
export const tomorrowPrefEnum = pgEnum('tomorrow_pref', ['lighter', 'similar', 'harder']);
export const questionTypeEnum = pgEnum('question_type', ['mcq', 'true_false', 'short', 'code']);
export const assessmentKindEnum = pgEnum('assessment_kind', ['topic', 'checkpoint', 'revision']);
export const contentSourceEnum = pgEnum('content_source', ['catalog', 'engine', 'ai']);
export const projectStatusEnum = pgEnum('project_status', ['not_started', 'in_progress', 'completed']);
export const messageRoleEnum = pgEnum('message_role', ['user', 'assistant']);
export const memoryKindEnum = pgEnum('memory_kind', [
	'strength',
	'weakness',
	'preference',
	'mistake',
	'skill',
	'goal',
	'project_context'
]);
export const memorySourceEnum = pgEnum('memory_source', ['assessment', 'check_in', 'mentor', 'onboarding', 'progress']);
export const notificationKindEnum = pgEnum('notification_kind', [
	'daily_reminder',
	'incomplete_plan',
	'revision_due',
	'milestone',
	'assessment_available',
	'roadmap_adjusted',
	'system'
]);
export const jobStatusEnum = pgEnum('job_status', ['queued', 'running', 'succeeded', 'failed']);
