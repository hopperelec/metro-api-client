import {ActiveTrainState, ParsedLastSeen, PlatformNumber} from "./types";

export { MetroApiClient } from './client';
export * from './types';

/**
 * Calculates the difference, in seconds, between two times in the timetable.
 * @param a - first time string in HHMMSS or HHMM format
 * @param b - second time string in HHMMSS or HHMM format
 * @param newDayHour - the hour (0-23) that marks the start of a new timetabled day
 */
export function compareTimes(a: string, b: string, newDayHour: number): number {
    let aHour = +a.slice(0, 2);
    if (aHour < newDayHour) aHour += 24;
    let bHour = +b.slice(0, 2);
    if (bHour < newDayHour) bHour += 24;
    const aTime = aHour * 60 * 60 + +a.slice(2, 4) * 60 + (+a.slice(4) || 0);
    const bTime = bHour * 60 * 60 + +b.slice(2, 4) * 60 + (+b.slice(4) || 0);
    return aTime - bTime;
}

const LAST_SEEN_REGEX = new RegExp(/^(?<state>Approaching|Arrived|Ready to start|Departed) (?<station>[a-zA-Z' ]*) platform (?<platform>[1-4]) at (?<hours>[01][0-9]|2[0-3]):(?<minutes>[0-5][0-9])$/);

/**
 * Parses the last seen string provided by the train statuses API.
 * @param lastSeen - the last seen string
 */
export function parseLastSeen(lastSeen: string) {
    const match = lastSeen.match(LAST_SEEN_REGEX);
    if (match?.groups) {
        return {
            state: match.groups.state as ActiveTrainState,
            station: match.groups.station,
            platform: +match.groups.platform as PlatformNumber,
            hours: +match.groups.hours,
            minutes: +match.groups.minutes,
        } as ParsedLastSeen
    }
}