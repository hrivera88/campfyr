import { Request } from 'express';
import { JwtPayload } from 'jsonwebtoken';

export interface AuthPayload extends JwtPayload {
    id: string;
}

export interface RequestWithUser extends Request {
    user?: AuthPayload;
}