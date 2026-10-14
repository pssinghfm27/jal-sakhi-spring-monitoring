// SPDX-License-Identifier: MIT
import type { Status } from '../api/types';

const LABEL: Record<Status, string> = {
  green:   'Within BIS',
  amber:   'Borderline',
  red:     'Unsafe',
  unknown: 'No data',
};

const CLS: Record<Status, string> = {
  green:   'pill-green',
  amber:   'pill-amber',
  red:     'pill-red',
  unknown: 'pill-muted',
};

export function StatusBadge({ status, label }: { status: Status; label?: string }) {
  return <span className={CLS[status]}>{label ?? LABEL[status]}</span>;
}
