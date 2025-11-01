"use client";

import { useMemo } from "react";
import type { ComponentType } from "react";
import * as Recharts from "recharts";
import type { HistoryPoint } from "@/lib/markets";

type Props = {
  history: HistoryPoint[];
};

type ChartPoint = {
  label: string;
  yes: number;
  no: number;
};

const ResponsiveContainer = Recharts.ResponsiveContainer as unknown as ComponentType<any>;
const LineChart = Recharts.LineChart as unknown as ComponentType<any>;
const Line = Recharts.Line as unknown as ComponentType<any>;
const XAxis = Recharts.XAxis as unknown as ComponentType<any>;
const YAxis = Recharts.YAxis as unknown as ComponentType<any>;
const CartesianGrid = Recharts.CartesianGrid as unknown as ComponentType<any>;
const TooltipComponent = Recharts.Tooltip as unknown as ComponentType<any>;

export default function ProbabilityChart({ history }: Props) {
  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat("es-CR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    []
  );

  const data = useMemo<ChartPoint[]>(
    () =>
      history.map((p) => ({
        label: formatter.format(new Date(p.t)),
        yes: Math.round(p.yes * 100),
        no: Math.round(p.no * 100),
      })),
    [history, formatter]
  );

  return (
    <div className="chart-wrapper">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 16, left: 0, right: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="4 4" stroke="var(--color-divider)" />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--color-text-subtle)", fontSize: 12 }}
            tickLine={{ stroke: "var(--color-divider)" }}
            axisLine={{ stroke: "var(--color-divider)" }}
            interval={3}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fill: "var(--color-text-subtle)", fontSize: 12 }}
            tickLine={{ stroke: "var(--color-divider)" }}
            axisLine={{ stroke: "var(--color-divider)" }}
          />
          <TooltipComponent
            formatter={(value: number) => [`${value}%`, "Probabilidad"]}
            labelFormatter={(label: string) => `Hora ${label}`}
            contentStyle={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "12px",
              color: "var(--color-text)",
              boxShadow: "var(--shadow-soft)"
            }}
          />
          <Line
            type="monotone"
            dataKey="yes"
            name="Sí"
            stroke="var(--color-success)"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="no"
            name="No"
            stroke="var(--color-danger)"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
