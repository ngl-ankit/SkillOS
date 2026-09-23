import { ctx } from './init';
import { assessmentRouter } from './routers/assessment';
import { checkInRouter } from './routers/checkin';
import { goalsRouter } from './routers/goals';
import { mentorRouter } from './routers/mentor';
import { notesRouter } from './routers/notes';
import { notificationsRouter } from './routers/notifications';
import { onboardingRouter } from './routers/onboarding';
import { planRouter } from './routers/plan';
import { profileRouter } from './routers/profile';
import { projectsRouter } from './routers/projects';
import { resourcesRouter } from './routers/resources';
import { revisionRouter } from './routers/revision';
import { roadmapRouter } from './routers/roadmap';
import { searchRouter } from './routers/search';
import { settingsRouter } from './routers/settings';
import { topicsRouter } from './routers/topics';
import { universeRouter } from './routers/universe';

export const appRouter = ctx.router({
	onboarding: onboardingRouter,
	profile: profileRouter,
	goals: goalsRouter,
	roadmap: roadmapRouter,
	topics: topicsRouter,
	plan: planRouter,
	checkIn: checkInRouter,
	resources: resourcesRouter,
	assessment: assessmentRouter,
	projects: projectsRouter,
	notes: notesRouter,
	mentor: mentorRouter,
	revision: revisionRouter,
	universe: universeRouter,
	search: searchRouter,
	settings: settingsRouter,
	notifications: notificationsRouter
});

export type AppRouter = typeof appRouter;
