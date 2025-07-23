import { vi } from "vitest";

const emitMock = vi.fn();
const onMock = vi.fn();
const offMock = vi.fn();

export const socket = {
    emit: emitMock,
    on: onMock,
    off: offMock,
};

export const io = vi.fn(() => socket);

export { emitMock, onMock, offMock };
