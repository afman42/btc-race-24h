import { runBars } from './vendor/makefun-bars.ts';
import { createStrategy } from './strategy.ts';

// The SDK owns the hello/batch/done wire and emits exactly one reply for every batch.
await runBars(createStrategy());
