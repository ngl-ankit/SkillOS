import { createContextFactory } from './init';
import { onboardingRouter } from './routers/onboarding';
import { profileRouter } from './routers/profile';
import { goalsRouter } from './routers/goals';
import { roadmapRouter } from './routers/roadmap';
import { topicsRouter } from './routers/topics';
import { planRouter } from './routers/plan';
import { checkInRouter } from './routers/checkin';
import { resourcesRouter } from './routers/resources';
import { assessmentRouter } from './routers/assessment';
import { projectsRouter } from './routers/projects';
import { notesRouter } from './routers/notes';
import { mentorRouter } from './routers/mentor';
import { revisionRouter } from './routers/revision';
import { universeRouter } from './routers/universe';
import { searchRouter } from './routers/search';
import { settingsRouter } from './routers/settings';
import { notificationsRouter } from './routers/notifications';

export const ctx = createContextFactory();

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
