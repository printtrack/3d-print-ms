"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export interface AssigneeUser {
  id: string;
  name: string;
  email?: string;
}

interface AssigneePickerProps {
  users: AssigneeUser[];
  value: string[];
  onChange: (ids: string[]) => Promise<void> | void;
  /** Show a compact icon-only trigger instead of a full-width button */
  compact?: boolean;
  disabled?: boolean;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function AssigneePicker({
  users,
  value,
  onChange,
  compact = false,
  disabled = false,
}: AssigneePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = users.filter((u) => value.includes(u.id));

  function toggle(userId: string) {
    const next = value.includes(userId)
      ? value.filter((id) => id !== userId)
      : [...value, userId];
    onChange(next);
  }

  async function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
  }

  if (compact) {
    return (
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 gap-1.5 text-muted-foreground hover:text-foreground"
            disabled={disabled}
          >
            {selected.length > 0 ? (
              <div className="flex -space-x-1">
                {selected.slice(0, 2).map((u) => (
                  <Avatar key={u.id} className="h-5 w-5 ring-1 ring-background" title={u.name}>
                    <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                      {getInitials(u.name)}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {selected.length > 2 && (
                  <div className="h-5 w-5 rounded-full bg-muted ring-1 ring-background flex items-center justify-center">
                    <span className="text-[9px] text-muted-foreground font-medium">
                      +{selected.length - 2}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <UserMinus className="h-3.5 w-3.5" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0" align="start">
          <AssigneePickerContent users={users} value={value} onToggle={toggle} />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className="w-full justify-between font-normal"
            disabled={disabled}
          >
            <span className="truncate">
              {selected.length === 0
                ? "Nicht zugewiesen"
                : selected.map((u) => u.name).join(", ")}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <AssigneePickerContent users={users} value={value} onToggle={toggle} />
        </PopoverContent>
      </Popover>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((u) => (
            <Badge key={u.id} variant="secondary" className="text-xs">
              {u.name}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function AssigneePickerContent({
  users,
  value,
  onToggle,
}: {
  users: AssigneeUser[];
  value: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <Command>
      <CommandInput placeholder="Suchen..." />
      <CommandList>
        <CommandEmpty>Keine Mitglieder gefunden.</CommandEmpty>
        <CommandGroup>
          {users.map((user) => {
            const selected = value.includes(user.id);
            return (
              <CommandItem
                key={user.id}
                value={user.name}
                onSelect={() => onToggle(user.id)}
              >
                <Check
                  className={`mr-2 h-4 w-4 ${selected ? "opacity-100" : "opacity-0"}`}
                />
                {user.name}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
