import {
  BPS,
  type Bar,
  type BarsState,
  type Bot,
  type BuyInput,
  type OrderInput,
  type SellInput,
} from './vendor/makefun-bars.ts';

const FAST_BARS = 30;
const SLOW_BARS = 180;
const MOMENTUM_BARS = 120;
const FAST_OVER_SLOW_BPS = 5n;
const PRICE_OVER_SLOW_BPS = 15n;
const MOMENTUM_ENTRY_BPS = 50n;
const MOMENTUM_EXIT_BPS = -35n;
const REVERSAL_CONFIRM_BARS = 12;
const TRAILING_STOP_BPS = 180n;
const HARD_STOP_BPS = 250n;
const COOLDOWN_BARS = 60;
const MAX_SLIPPAGE_BPS = 150;

interface Series {
  closes: bigint[];
  fastSum: bigint;
  slowSum: bigint;
  peak: bigint;
  reversalBars: number;
}

function aboveByBps(a: bigint, b: bigint, bps: bigint): boolean {
  return a * BPS > b * (BPS + bps);
}

function belowByBps(a: bigint, b: bigint, bps: bigint): boolean {
  return a * BPS < b * (BPS - bps);
}

function append(series: Series, bar: Bar): void {
  const close = BigInt(bar.c);
  series.closes.push(close);
  series.fastSum += close;
  series.slowSum += close;
  if (series.closes.length > FAST_BARS) series.fastSum -= series.closes[series.closes.length - FAST_BARS - 1]!;
  if (series.closes.length > SLOW_BARS) series.slowSum -= series.closes[series.closes.length - SLOW_BARS - 1]!;
  // No future bar is synthesized for a gap: append is called only for bars received in this batch.
  if (series.closes.length > SLOW_BARS + 1) series.closes.shift();
}

function movingAverage(series: Series, bars: number): bigint | null {
  if (series.closes.length < bars) return null;
  const sum = bars === FAST_BARS ? series.fastSum : series.slowSum;
  return sum / BigInt(bars);
}

/**
 * A low-turnover, long-only BTC trend strategy. Signals are derived only from bars already received;
 * the SDK supplies authoritative positions and accounts, so rejected orders are never imagined filled.
 */
export function createStrategy(): Bot {
  const history = new Map<string, Series>();
  let cooldown = 0;
  let pendingEntry = false;
  let riskOff = false;
  let highWater = 0n;

  return {
    onHello(state) {
      history.clear();
      cooldown = 0;
      pendingEntry = false;
      riskOff = false;
      highWater = state.equity;
    },

    onBatch(state: BarsState, batch): OrderInput[] {
      // Every previous order has resolved before this callback. In particular, a rejected buy never
      // becomes an imagined position; wait before reconsidering it from a later, fresh signal.
      const entryWasPending = pendingEntry;
      pendingEntry = false;
      if (entryWasPending && state.positions.size === 0) cooldown = COOLDOWN_BARS;
      if (state.equity > highWater) highWater = state.equity;
      if (highWater > 0n && state.equity * BPS < highWater * (BPS - HARD_STOP_BPS)) riskOff = true;
      if (cooldown > 0) cooldown--;

      const orders: OrderInput[] = [];
      for (const bar of batch.bars) {
        let series = history.get(bar.symbol);
        if (series === undefined) {
          series = { closes: [], fastSum: 0n, slowSum: 0n, peak: 0n, reversalBars: 0 };
          history.set(bar.symbol, series);
        }
        append(series, bar);
        const close = BigInt(bar.c);
        const held = state.positions.get(bar.symbol);

        if (held !== undefined) {
          if (close > series.peak) series.peak = close;
          const fast = movingAverage(series, FAST_BARS);
          const slow = movingAverage(series, SLOW_BARS);
          const lookback = series.closes.length > MOMENTUM_BARS ? series.closes[series.closes.length - MOMENTUM_BARS - 1]! : null;
          const reversal = fast !== null && slow !== null && lookback !== null
            && fast < slow && belowByBps(close, lookback, -MOMENTUM_EXIT_BPS);
          series.reversalBars = reversal ? series.reversalBars + 1 : 0;

          const value = state.value(bar.symbol, held.qty, close);
          const hardStop = value * BPS <= held.cost * (BPS - HARD_STOP_BPS);
          const trailingStop = series.peak > 0n && close * BPS <= series.peak * (BPS - TRAILING_STOP_BPS);
          if (riskOff || hardStop || trailingStop || series.reversalBars >= REVERSAL_CONFIRM_BARS) {
            const sell: SellInput = { side: 'sell', symbol: bar.symbol, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS };
            orders.push(sell);
            cooldown = COOLDOWN_BARS;
            series.reversalBars = 0;
          }
          continue;
        }

        series.peak = 0n;
        series.reversalBars = 0;
        if (state.warmingUp || riskOff || cooldown > 0 || pendingEntry) continue;
        const fast = movingAverage(series, FAST_BARS);
        const slow = movingAverage(series, SLOW_BARS);
        const lookback = series.closes.length > MOMENTUM_BARS ? series.closes[series.closes.length - MOMENTUM_BARS - 1]! : null;
        if (fast === null || slow === null || lookback === null) continue;

        const trend = aboveByBps(fast, slow, FAST_OVER_SLOW_BPS)
          && aboveByBps(close, slow, PRICE_OVER_SLOW_BPS)
          && aboveByBps(close, lookback, MOMENTUM_ENTRY_BPS);
        if (!trend) continue;

        let notional = state.cash;
        const room = state.weightRoom(bar.symbol);
        if (room < notional) notional = room;
        const minimum = BigInt(state.hello.fees.min_notional_quote_units);
        if (notional < minimum) continue;
        const buy: BuyInput = { side: 'buy', symbol: bar.symbol, notional_quote_units: notional, max_slippage_bps: MAX_SLIPPAGE_BPS };
        orders.push(buy);
        pendingEntry = true;
      }
      return orders.slice(0, state.hello.caps.max_orders_per_bar);
    },
  };
}
