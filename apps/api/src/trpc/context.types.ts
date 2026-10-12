import type { Session, SessionUser } from "@crm/auth";
import type { Viewer } from "@crm/db/visibility";
import type { Request } from "express";

export type BaseTrpcContext = {
	req?: Request;
	session: Session | null;
};

export type AuthedTrpcContext = BaseTrpcContext & {
	user: SessionUser;
	viewer: Viewer;
};
