import { availabilityRouter } from "@/server/api/routers/availability";
import { bookingRouter } from "@/server/api/routers/booking";
import { eventTypeRouter } from "@/server/api/routers/eventType";
import { googleCalendarRouter } from "@/server/api/routers/googleCalendar";
import { groupRouter } from "@/server/api/routers/group";
import { invitationRouter } from "@/server/api/routers/invitation";
import { profileRouter } from "@/server/api/routers/profile";
import { slotsRouter } from "@/server/api/routers/slots";
import { teamRouter } from "@/server/api/routers/team";
import { userRouter } from "@/server/api/routers/user";
import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
	googleCalendar: googleCalendarRouter,
	eventType: eventTypeRouter,
	availability: availabilityRouter,
	booking: bookingRouter,
	invitation: invitationRouter,
	profile: profileRouter,
	user: userRouter,
	slots: slotsRouter,
	team: teamRouter,
	group: groupRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.user.list();
 *       ^? User[]
 */
export const createCaller = createCallerFactory(appRouter);
