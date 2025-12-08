"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Send,
  BarChart2,
  Globe,
  Video,
  PlaneTakeoff,
  AudioLines
} from "lucide-react";
import { Input } from "@/components/ui/input";

function useDebounce<T>(value: T, delay = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export interface Action {
  id: string;
  label: string;
  icon: React.ReactNode;
  description?: string;
  short?: string;
  end?: string;
}

interface SearchResult {
  actions: Action[];
}

const defaultActions: Action[] = [
  {
    id: "book",
    label: "Book tickets",
    icon: <PlaneTakeoff className="h-4 w-4 text-blue-500" />,
    description: "Operator",
    short: "⌘K",
    end: "Agent"
  },
  {
    id: "summarize",
    label: "Summarize",
    icon: <BarChart2 className="h-4 w-4 text-orange-500" />,
    description: "gpt-4o",
    short: "⌘cmd+p",
    end: "Command"
  },
  {
    id: "screen",
    label: "Screen Studio",
    icon: <Video className="h-4 w-4 text-purple-500" />,
    description: "gpt-4o",
    end: "Application"
  },
  {
    id: "jarvis",
    label: "Talk to Jarvis",
    icon: <AudioLines className="h-4 w-4 text-[color:var(--color-success)]" />,
    description: "gpt-4o voice",
    end: "Active"
  },
  {
    id: "translate",
    label: "Translate",
    icon: <Globe className="h-4 w-4 text-blue-500" />,
    description: "gpt-4o",
    end: "Command"
  }
];

type Props = {
  actions?: Action[];
};

const container = {
  hidden: { opacity: 0, height: 0 },
  show: {
    opacity: 1,
    height: "auto",
    transition: { height: { duration: 0.4 }, staggerChildren: 0.1 }
  },
  exit: {
    opacity: 0,
    height: 0,
    transition: { height: { duration: 0.3 }, opacity: { duration: 0.2 } }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3 }
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: { duration: 0.2 }
  }
};

function ActionSearchBar({ actions = defaultActions }: Props) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);
  const debouncedQuery = useDebounce(query, 200);

  useEffect(() => {
    if (!isFocused) {
      setResult(null);
      return;
    }

    if (!debouncedQuery) {
      setResult({ actions });
      return;
    }

    const normalized = debouncedQuery.toLowerCase().trim();
    const filtered = actions.filter((action) => action.label.toLowerCase().includes(normalized));
    setResult({ actions: filtered });
  }, [debouncedQuery, isFocused, actions]);

  function handleFocus() {
    setSelectedAction(null);
    setIsFocused(true);
  }

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="relative flex flex-col items-center">
        <div className="w-full max-w-md pt-4 pb-2">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block" htmlFor="action-search">
            Buscar acciones
          </label>
          <div className="relative">
            <Input
              id="action-search"
              type="text"
              placeholder="¿Qué quieres hacer?"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={handleFocus}
              onBlur={() => setTimeout(() => setIsFocused(false), 150)}
              className="pl-3 pr-9 py-1.5 h-10 text-sm rounded-lg focus-visible:ring-offset-0"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4">
              <AnimatePresence mode="popLayout">
                {query.length > 0 ? (
                  <motion.div
                    key="send"
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 20, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Send className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="search"
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 20, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Search className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="w-full max-w-md">
          <AnimatePresence>
            {isFocused && result && !selectedAction && (
              <motion.div
                className="w-full border rounded-md shadow-sm overflow-hidden dark:border-gray-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur"
                variants={container}
                initial="hidden"
                animate="show"
                exit="exit"
              >
                <motion.ul>
                  {result.actions.map((action) => (
                    <motion.li
                      key={action.id}
                      className="px-3 py-2 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-zinc-900 cursor-pointer"
                      variants={item}
                      layout
                      onClick={() => setSelectedAction(action)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">{action.icon}</span>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{action.label}</span>
                          {action.description && (
                            <span className="text-xs text-gray-400">{action.description}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        {action.short && <span>{action.short}</span>}
                        {action.end && <span>{action.end}</span>}
                      </div>
                    </motion.li>
                  ))}
                </motion.ul>
                <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500 flex items-center justify-between">
                  <span>Presiona ⌘K para abrir acciones</span>
                  <span>ESC para cancelar</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export { ActionSearchBar };
