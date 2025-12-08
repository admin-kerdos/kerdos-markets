import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

type HoverEffectItem = {
  title: string;
  description: string;
  link: string;
};

type HoverEffectProps = {
  items: HoverEffectItem[];
  className?: string;
};

export function HoverEffect({ items, className }: HoverEffectProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 py-10", className)}>
      {items.map((item, index) => (
        <Link
          href={item.link}
          key={item.link}
          className="relative group block h-full w-full p-2"
          onMouseEnter={() => setHoveredIndex(index)}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <AnimatePresence>
            {hoveredIndex === index && (
              <motion.span
                className="absolute inset-0 block h-full w-full rounded-3xl bg-neutral-200 dark:bg-slate-800/80"
                layoutId="hoverBackground"
                initial={{ opacity: 0 }}
                animate={{
                  opacity: 1,
                  transition: { duration: 0.15 }
                }}
                exit={{
                  opacity: 0,
                  transition: { duration: 0.15, delay: 0.2 }
                }}
              />
            )}
          </AnimatePresence>
          <Card>
            <CardTitle>{item.title}</CardTitle>
            <CardDescription>{item.description}</CardDescription>
          </Card>
        </Link>
      ))}
    </div>
  );
}

type CardProps = {
  className?: string;
  children: React.ReactNode;
};

export function Card({ className, children }: CardProps) {
  return (
    <div
      className={cn(
        "relative z-20 h-full w-full overflow-hidden rounded-2xl border border-transparent bg-black p-4 dark:border-white/20 group-hover:border-slate-700",
        className
      )}
    >
      <div className="relative z-50">
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

type CardTitleProps = {
  className?: string;
  children: React.ReactNode;
};

export function CardTitle({ className, children }: CardTitleProps) {
  return <h4 className={cn("mt-4 font-bold tracking-wide text-zinc-100", className)}>{children}</h4>;
}

type CardDescriptionProps = {
  className?: string;
  children: React.ReactNode;
};

export function CardDescription({ className, children }: CardDescriptionProps) {
  return (
    <p className={cn("mt-8 text-sm leading-relaxed tracking-wide text-zinc-400", className)}>
      {children}
    </p>
  );
}
