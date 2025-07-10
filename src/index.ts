import {ActiveTrainState, ParsedLastSeen, ParsedTimesAPILocation, PlatformNumber} from "./types";

export { MetroApiClient } from './client';
export * from './types';

/**
 * Calculates the difference, in seconds, between two times in the timetable.
 * @param a - first time in seconds since midnight
 * @param b - second time in seconds since midnight
 * @param newDayHour - the hour (0-23) that marks the start of a new timetabled day
 */
export function compareTimes(a: number, b: number, newDayHour: number) {
    const newDaySeconds = newDayHour * 3600;
    function normalizeTime(time: number) {
        // Javascript allows % to return negative values, so we need to coerce it to a positive value
        return ((time - newDaySeconds) % 86400 + 86400) % 86400;
    }
    return normalizeTime(a) - normalizeTime(b);
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

const TIMES_API_LOCATION_REGEX = new RegExp(/^(?<station>[a-zA-Z' ]*) Platform (?<platform>[1-4])$/);

/**
 * Parses the location string provided by the times API.
 * @param location - the location string
 */
export function parseTimesAPILocation(location: string) {
    const match = location.match(TIMES_API_LOCATION_REGEX);
    if (match?.groups) {
        return {
            station: match.groups.station,
            platform: +match.groups.platform as PlatformNumber,
        } as ParsedTimesAPILocation
    }
}