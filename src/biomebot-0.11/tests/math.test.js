
import { describe, expect, it } from 'vitest';
import {
    zeros,
    identity,
    concat,
    add,
    resize,
    multiply,
} from 'mathjs';

describe('delay effector', () => {
    const level = 0.5;
    for (let size = 2; size < 7; size++) {
        let m = identity(size, size);
        let x = identity(size, size);
        const z = zeros(1, size);
        let k = 1;
        for (let i = 1; i < size && i < 4; i++) {
            k *= level;
            x = concat(z, x, 0);
            x = resize(x, [size, size])
            x = multiply(x, k);
            m = add(m, x);
        }
        console.log("size=", size, "effector=", m);
    }
})