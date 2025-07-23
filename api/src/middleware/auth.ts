import { NextFunction, Request, Response } from 'express';
import jwt, {JwtPayload} from 'jsonwebtoken';
import { RequestWithUser, AuthPayload } from '../types/express';

const authenticate = (req: RequestWithUser, res: Response, next: NextFunction) => { 
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.sendStatus(401);
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
        throw new Error('JWT_SECRET enviroment variable is not set');
    }

    const token = authHeader.split(' ')[1];

    if (!token) return res.status(401).json({error: 'Token missing'});

    try { 
        const payload = jwt.verify(token, JWT_SECRET);
        if (typeof payload === 'string') {
            return res.status(403).json({error: 'Invalid token payload'});
        }
        req.user = payload as AuthPayload;
        next();
    } catch (e) {
        res.status(403).json({error: 'Invalid Token'});
     }
}

export default authenticate;