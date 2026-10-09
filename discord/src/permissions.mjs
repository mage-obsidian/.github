export const Permission = Object.freeze({
  ADD_REACTIONS: 1n << 6n,
  VIEW_CHANNEL: 1n << 10n,
  SEND_MESSAGES: 1n << 11n,
  MENTION_EVERYONE: 1n << 17n,
  CREATE_PUBLIC_THREADS: 1n << 35n,
  CREATE_PRIVATE_THREADS: 1n << 36n,
  SEND_MESSAGES_IN_THREADS: 1n << 38n,
  ADMINISTRATOR: 1n << 3n,
});

export function bits(...flags) {
  return flags.reduce((sum, flag) => sum | flag, 0n).toString();
}

export const READ_ONLY = bits(
  Permission.SEND_MESSAGES,
  Permission.SEND_MESSAGES_IN_THREADS,
  Permission.CREATE_PUBLIC_THREADS,
  Permission.CREATE_PRIVATE_THREADS,
);

export const HIDDEN = bits(Permission.VIEW_CHANNEL);
