import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { PrismaClient } from '../../src/generated/prisma';
import authRoutes from '../../src/routes/auth';


const prisma = new PrismaClient();

const app = express();
app.use(cookieParser());
app.use(bodyParser.json());
app.use('/auth', authRoutes);

const TEST_USER = {
    email: 'testuser@example.com',
    username: 'testuser',
    password: 'password123',
    organizationName: 'Test Organization'
}

beforeAll(async () => {
    await prisma.message.deleteMany();     // If message has FK to user
    await prisma.roomUser.deleteMany();    // Delete RoomUser before User
    await prisma.user.deleteMany();        // Now it's safe to delete User
});

afterAll(async () => {
    await prisma.$disconnect();
});

describe('Auth Routes', () => {
    test('POST /auth/register should create a new user', async () => {
        const res = await request(app).post('/auth/register').send(TEST_USER);
        expect(res.status).toBe(200);
        expect(res.body.token).toBeDefined();

        const user = await prisma.user.findUnique({ where: { email: TEST_USER.email } });
        expect(user).not.toBeNull();
        // Password should be hashed
        expect(user?.passwordHash).not.toBe(TEST_USER.password);
    });

    test('POST /auth/login should return a JWT with valid credentials', async () => {
        const res = await request(app).post('/auth/login').send({
            email: TEST_USER.email,
            password: TEST_USER.password
        });

        expect(res.status).toBe(200);
        expect(res.headers['set-cookie']).toBeDefined();
        expect(res.headers['set-cookie'][0]).toMatch(/refreshToken=.*HttpOnly/);
    });

    test('POST /auth/login should fail with invalid password', async () => {
        const res = await request(app).post('/auth/login').send({
            email: TEST_USER.email,
            password: 'wrong wong wongwonfo'
        });

        expect(res.status).toBe(401);
    });
    test('GET /auth/me returns current user when bearer token is present, ', async () => {
        const loginRes = await request(app).post('/auth/login').send({ email: TEST_USER.email, password: TEST_USER.password });

        const accessToken = loginRes.body.token;

        const meRes = await request(app).get('/auth/me').set('Authorization', `Bearer ${accessToken}`);

        expect(meRes.status).toBe(200);
        expect(meRes.body.email).toBe(TEST_USER.email);
    });
    test('POST /auth/logout clears the auth cookie, ', async () => {
        const loginRes = await request(app).post('/auth/login').send({ email: TEST_USER.email, password: TEST_USER.password });
        const cookie = loginRes.headers['set-cookie'];
        const logoutRes = await request(app).post('/auth/logout').set('Cookie', cookie);
        expect(logoutRes.status).toBe(200);
        expect(logoutRes.headers['set-cookie'][0]).toMatch(/refreshToken=;/);
        expect(logoutRes.headers['set-cookie'][0]).toMatch(/Expires=Thu, 01 Jan 1970/);
    });
    test('GET /auth/me returns 401 when cookie is missing', async () => {
        const res = await request(app).get('/auth/me');
        expect(res.status).toBe(401);
    });
    test('POST /auth/refresh returns new token cookie', async () => {
        const loginRes = await request(app).post('/auth/login').send({ email: TEST_USER.email, password: TEST_USER.password });
        const cookie = loginRes.headers['set-cookie'];
        const refreshRes = await request(app).post('/auth/refresh').set('Cookie', cookie);
        expect(refreshRes.status).toBe(200);
        expect(refreshRes.headers['set-cookie'][0]).toMatch(/refreshToken=.*HttpOnly/);
    })
});