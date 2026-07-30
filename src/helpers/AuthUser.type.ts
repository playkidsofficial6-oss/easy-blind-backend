import { Types } from "mongoose";
import { UserRole } from "../users/schemas/user.schema";

export interface AuthUser {
    userId: Types.ObjectId,
    email: string,
    role: UserRole
}