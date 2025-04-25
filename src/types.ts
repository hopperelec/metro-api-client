// --- Filtering ---

/**
 * A list of properties, which are themselves dot-separated lists of keys.
 * To only select keys of a record, use the `"keys"` property; for example, `?props=trains.keys`.
 * For arrays or records, keys will be filtered on each element instead.
 * If no properties are specified, all properties will be included.
 */
export type PropsFilter = string[];

/** Interface for responses allowing filtering of properties. */
export interface FilterableProps {
    /** Properties to include in the response. */
    props?: PropsFilter;
}

// See: https://stackoverflow.com/a/51365037/17168710
type RecursivePartial<T> = {
    [P in keyof T]?:
    T[P] extends (infer U)[] ? RecursivePartial<U>[] :
        T[P] extends object | undefined ? RecursivePartial<T[P]> :
            T[P];
};

type FilteredByProps<
    T, Props extends PropsFilter | undefined
> = Props extends undefined ? T : RecursivePartial<T>;

export type TimeFilter =
    | { at: Date; }
    | { from: Date; }
    | { to: Date; }
    | { from: Date; to: Date; };

// --- Underlying API Related Types ---

/**
 * A unique identifier for a platform.
 * This is usually in the format `<station code>;<platform number>` (e.g., `"MTW;4"`).
 * However, the proxy does not check if this is in the expected format,
 * so you should do your own checks if you need to parse this
 */
export type PlatformCode = string;

/** Information about a train derived from the Times API. */
export interface TimesApiData {
    /** Last event for the train. */
    lastEvent: {
        /** Type of the last event (e.g., `"APPROACHING"`, `"ARRIVED"`). */
        type: string;
        /**
         * A human-readable representation of the station and platform where the last event occurred.
         * This is usually in the format "`<station name> Platform <platform number>`".
         * However, the proxy does not check if this is in the expected format,
         * so you should do your own checks if you need to parse this.
         */
        location: string;
        /** Time of the last event. */
        time: Date;
    };
    /** List of planned destinations, in order. */
    plannedDestinations: {
        /** Name of the destination station. */
        name: string;
        /** When and where this is expected to become the current destination. */
        from: {
            /** Where this is expected to become the current destination. */
            platformCode: PlatformCode;
            /** When this is expected to become the current destination. */
            time: Date;
        }
    }[];
    /** List of next platforms, in order of planned arrival. */
    nextPlatforms: {
        /** The code of the platform. */
        code: PlatformCode
        /** When the train is expected to arrive at this platform. */
        time: {
            /** In how many minutes the train is due. `0` for "Due", `-1` for "Arrived", `-2` for "Delayed". */
            dueIn: number;
            /** The scheduled time, according to Nexus, or null. */
            actualScheduledTime: Date | null;
            /** The predicted time, according to Nexus. */
            actualPredictedTime: Date;
        };
    }[];
}

/** Information about a train derived from the Train Statuses API. */
export interface TrainStatusesApiData {
    /** Name of the destination. */
    destination: string;
    /**
     * Last seen status of the train, in the format used on the Pop app's embedded map.
     * The proxy does not check if this is in the expected format,
     * so you should do your own checks if you need to parse this.
     */
    lastSeen: string;
}

/** Collated train data from one or both APIs. */
export type CollatedTrain =
    | { timesAPI: TimesApiData; trainStatusesAPI?: TrainStatusesApiData }
    | { timesAPI?: TimesApiData; trainStatusesAPI: TrainStatusesApiData };

// --- History ---

export interface BaseHistoryEntry {
    /** Time of the heartbeat that created this history entry. */
    date: Date;
}

/** Summary of a train's history. */
export interface HistorySummary {
    /** Number of history entries available. */
    numEntries: number;
    /** When the first entry was made. */
    firstEntry: Date;
    /** When the last entry was made. */
    lastEntry: Date;
}

// --- Train History ---

/** The status of a train in the history. Notably omits nextPlatforms from TimesApiData. */
export type ActiveTrainHistoryStatus =
    | { timesAPI: Omit<TimesApiData, "nextPlatforms">; trainStatusesAPI?: TrainStatusesApiData }
    | { timesAPI?: Omit<TimesApiData, "nextPlatforms">; trainStatusesAPI: TrainStatusesApiData }

/** Base interface for a single entry in a train's history. */
export interface BaseTrainHistoryEntry extends BaseHistoryEntry {
    /** Whether the train was active at this time. */
    active: boolean;
}

/** A single entry in a train's history when the train is inactive. */
export interface InactiveTrainHistoryEntry extends BaseTrainHistoryEntry {
    active: false;
}

/** A single entry in a train's history when the train is active. */
export interface ActiveTrainHistoryEntry extends BaseTrainHistoryEntry {
    active: true;
    /** The train's status at this time */
    status: ActiveTrainHistoryStatus;
}

/** A single entry in a train's history. */
export type TrainHistoryEntry = ActiveTrainHistoryEntry | InactiveTrainHistoryEntry;

// --- `/constants` Endpoint ---

/** Response from the `/constants` endpoint. */
export interface ApiConstants<
    StationCodes extends Record<string, string> = Record<string, string>,
    Lines extends Record<string, (keyof StationCodes)[]> = Record<string, (keyof StationCodes)[]>,
> {
    /** Hour at which the timetable resets to the next day (0-23). */
    NEW_DAY_HOUR: number;
    /** Interval at which history is always updated */
    PASSIVE_REFRESH_INTERVAL: number;
    /** Minimum time between updates to the history, such as when a request is made for a train's current status */
    ACTIVE_REFRESH_MINIMUM_TIMEOUT: number;
    /** Maximum number of train history entries kept, per train, before old entries are purged */
    MAX_TRAIN_HISTORY_LENGTH: number;
    /** Maximum age of history entries, in milliseconds, before being purged */
    MAX_HISTORY_AGE: number;
    /** Maximum number of history entries (limit) returned by `/history/train/:trn` */
    MAX_HISTORY_REQUEST_LIMIT: number;
    /** Default number of history entries (limit) returned by `/history/train/:trn` if no limit is specified */
    DEFAULT_HISTORY_REQUEST_LIMIT: number;
    /** List of "station" codes where trains may be timetabled to stop at, but not while holding passengers, such as sidings */
    NIS_STATIONS: (keyof StationCodes)[];
    /** Map of lines and the stations on them */
    LINES: Lines;
    /** Map from station codes to human-readable names */
    STATION_CODES: StationCodes;
    /**
     * Map from line -> direction -> station code -> route code
     * Note that not every station will have a known route code.
     */
    ROUTE_CODES: Record<keyof Lines, Record<TrainDirection, Record<keyof StationCodes, number>>>;
}

// --- `/trains` Endpoint ---

/** Options for the `/trains` endpoint */
export interface TrainsOptions extends FilterableProps {}

/** Response from the `/trains` endpoint, assuming all properties are present. */
export interface FullTrainsResponse {
    /** Time of the last heartbeat */
    lastChecked: Date;
    /** List of all active trains */
    trains: Record<string, {
        /** The train's current status */
        status: CollatedTrain;
        /** When this train's status last changed */
        lastChanged: Date;
    }>;
}

/** Response from the `/trains` endpoint. */
export type TrainsResponse<Options extends TrainsOptions> = FilteredByProps<FullTrainsResponse, Options["props"]>;

// --- `/train/:trn` Endpoint ---

/** Options for the `/train/:trn` endpoint */
export interface TrainOptions extends FilterableProps {}

/**
 * Expected timetabled location for a train.
 * The train should be at or between `station1` and `station2`.
 *
 * If the train is not expected to be in service yet, `station1`, `station2` and `destination`
 * will all be the name of the arrival/departure `place` (e.g. `"Gosforth Depot"`)
 */
export interface ExpectedTrainState {
    /** State of the train */
    state: 'not-started' | 'starting' | 'active' | 'ending' | 'ended' | 'nis';
    /** Station code (e.g., `"MTS"`) or arrival/departure `place` (e.g., `"Gosforth Depot"`) */
    station1: string;
    /** Station code (e.g., `"CEN"`) or arrival/departure `place` (e.g., `"Gosforth Depot"`) */
    station2: string;
    /** Station code (e.g., `"SSS"`) or arrival/departure `place` (e.g., `"Gosforth Depot"`) */
    destination: string;
}

/** Base interface for `/train/:trn` endpoint response. */
export interface FullTrainResponse {
    /** Time of the last heartbeat */
    lastChecked: Date;
    /** When this train's status last changed, or null if this train has not been seen recently */
    lastChanged: Date | null;
    /** Expected state of the train, or null if the train is not timetabled to be in service */
    timetable: ExpectedTrainState | null;
    /** The train's current status, if the train is currently active */
    status?: CollatedTrain;
}

/** Response from the `/train/:trn` endpoint. */
export type TrainResponse<Options extends TrainOptions> = FilteredByProps<FullTrainResponse, Options["props"]>;

// --- `/history` Endpoint ---

export interface HistorySummaryResponse {
    /** Time of the last heartbeat */
    lastChecked: Date;
    /** Map of train running numbers (TRNs, without the leading "T", e.g. "101") to their history summaries */
    trains: Record<string, HistorySummary>;
    /** History summary for the heartbeat errors */
    heartbeatErrors: HistorySummary;
    /** History summary for the heartbeat warnings */
    heartbeatWarnings: HistorySummary;
}

// --- `/history/train/:trn` Endpoint

/** Options for `/history/train/:trn` endpoint */
export interface TrainHistoryOptions {
    /** Range of time to get the history for */
    time?: TimeFilter;
    /**
     * Limit the number of results.
     * Check `/constants` for the default and maximum values.
     */
    limit?: number;
    /**
     * Filter by active state.
     * `true`: Only include entries where the train was active.
     * `false`: Only include entries marking transitions between active/inactive.
     * `undefined` (default): Include all entries.
     */
    active?: boolean;
    /** Property filter string. */
    props?: PropsFilter;
}

/** Response from the `/history/train/:trn` endpoint, assuming all properties are present. */
export interface FullTrainHistoryResponse {
    /** Time of the last heartbeat */
    lastChecked: Date;
    /** A summary of the train's history. */
    summary: HistorySummary;
    /** The selected history entries. */
    extract: TrainHistoryEntry[];
}

export interface FullActiveTrainHistoryResponse extends FullTrainHistoryResponse {
    extract: ActiveTrainHistoryEntry[];
}

/** Response from the `/history/train/:trn` endpoint. */
export type TrainHistoryResponse<Options extends TrainHistoryOptions> = FilteredByProps<
    Options extends { active: true }
        ? FullActiveTrainHistoryResponse
        : FullTrainHistoryResponse,
    Options["props"]
>;

// --- `/timetable` Endpoint ---

/** Options for the `/timetable` endpoint */
export interface TimetableOptions {
    /**
     * Date to get the timetable for, defaults to today.
     * Note that the timetable usually crosses midnight into the next day.
     */
    date?: Date;
    /** Filter by Train Running Number (TRN, without the leading "T", e.g. `"101"`), defaults to all TRNs */
    trn?: string;
    /** Filter by station code. */
    station?: string;
    /**
     * Which directions to include, if any.
     * `"in"` for Airport to South Hylton or St James to South Shields.
     * `"out"` for South Hylton to Airport or South Shields to St James.
     */
    direction?: 'in' | 'out' | 'none';
    /** Which empty maneuvers to include, if any. */
    emptyManeuvers?: 'arrival' | 'departure' | 'none';
    /** Properties to include in the empty maneuvers. */
    emptyManeuverProps?: PropsFilter;
    /** Properties to include in the tables. */
    tableProps?: PropsFilter;
}

/** Arrival/Departure time in "HHMMSS" format. */
export type ArrivalTime = string;

/** Direction of a train. */
export type TrainDirection = "in" | "out";

export interface BaseRoute {
    /** Code which identifies the destination and line. */
    code: number;
}

/** A route in the timetable, including all stations and their expected arrival times. */
export interface AllStationsRoute extends BaseRoute {
    /** Map of stations and their expected arrival times. */
    stations: Record<string, ArrivalTime>;
}

/** A route in the timetable and the expected arrival time at a specific station. */
export interface SingleStationRoute extends BaseRoute {
    /** The expected arrival time at the requested station. */
    time: ArrivalTime;
}

/** A description of how a train, without passengers on board, gets to or from storage */
export interface TrainEmptyManeuver {
    /** Where the maneuver starts or ends (e.g., `"Gosforth Depot"`) */
    place: string;
    /** The time the maneuver starts or ends, in "HHMM" format */
    time: string;
    /** A description of the maneuver */
    via: string;
}

/** A description of the maneuver a train does before starting service. */
export interface FullDeparture extends TrainEmptyManeuver {
    /** Where the maneuver starts (e.g., `"Gosforth Depot"`) */
    place: string;
    /** The time the maneuver starts, in "HHMM" format */
    time: string;
    /** A description of the maneuver, after departing */
    via: string;
}

/** A description of the maneuver a train does after ending service. */
export interface FullArrival extends TrainEmptyManeuver {
    /** Where the maneuver ends (e.g., `"Gosforth Depot"`) */
    place: string;
    /** The time the maneuver ends, in "HHMM" format */
    time: string;
    /** A description of the maneuver, after ending service */
    via: string;
}

/** Timetable information for a single train on a specific day type. */
export interface TrainTimetable<
    Route extends BaseRoute = AllStationsRoute,
    EmptyManeuverProps extends PropsFilter | undefined = undefined,
    TableProps extends PropsFilter | undefined = undefined,
> {
    /** The maneuver the train does before starting service. */
    departure: FilteredByProps<FullDeparture, EmptyManeuverProps>;
    /** The maneuver the train does after ending service. */
    arrival: FilteredByProps<FullArrival, EmptyManeuverProps>;
    /** In-line timetable for the train. */
    in: FilteredByProps<Route, TableProps>[];
    /** Out-line timetable for the train. */
    out: FilteredByProps<Route, TableProps>[];
}

/** A proxy for TrainTimetable, based on TimetableOptions. */
export type TrainTimetableFromOptions<Options extends TimetableOptions> =
    TrainTimetable<
        Options["station"] extends string ? AllStationsRoute : SingleStationRoute,
        Options["emptyManeuverProps"],
        Options["tableProps"]
    >;

/** Response from the `/timetable` endpoint. */
export type TimetableResponse<Options extends TimetableOptions> =
    TimetableOptions extends { trn: string }
        ? TrainTimetableFromOptions<Options>
        : Record<string, TrainTimetableFromOptions<Options>>;

// --- `/stream` Endpoint ---

/** Base interface for responses from the `/stream` endpoint. */
export interface BaseStreamOptions {
    /** Which types of events to include in the stream. Defaults to all. */
    type?: 'trains' | 'errors';
}

/** Receive all events (default). */
export interface StreamAllOptions extends BaseStreamOptions, FilterableProps {
    type: undefined;
}

/** Only receive new-history events. */
export interface StreamTrainsOptions extends BaseStreamOptions, FilterableProps {
    type: 'trains';
    /** A list of Train Running Numbers (TRNs, without the leading "T", e.g. "101") to receive new-history updates for. */
    trns?: string[];
}

/** Only receive heartbeat-error (and optionally heartbeat-warnings) events. */
export interface StreamErrorsOptions extends BaseStreamOptions {
    type: 'errors';
    /** Whether to also receive warnings. */
    warnings?: boolean;
    /**
     * A list of internal API identifiers to receive errors (and optionally warnings) for.
     * See: https://gist.github.com/hopperelec/c23eb872b83b5584122e61a676394ff3#apis
     */
    apis?: string[];
}

/** Options for the `/stream` endpoint. */
export type StreamOptions = StreamAllOptions | StreamTrainsOptions | StreamErrorsOptions;

/** Payload for the `new-history` SSE event, assuming all properties are present. */
export interface FullNewHistoryPayload {
    date: Date;
    trains: Record<string, Omit<TrainHistoryEntry, "date">>;
}

/** Payload for the `new-history` SSE event. */
export type NewHistoryPayload = RecursivePartial<FullNewHistoryPayload>;

/** Payload for the `heartbeat-error` SSE event. */
export interface HeartbeatErrorPayload {
    /**
     * Identifier of the API that produced the error.
     * See: https://gist.github.com/hopperelec/c23eb872b83b5584122e61a676394ff3#apis
     */
    api: string;
    /** String containing the error message. */
    error: string;
}

/** Payload for the `heartbeat-warnings` SSE event. */
export interface HeartbeatWarningPayload {
    /**
     * Identifier of the API that produced the warning.
     * See: https://gist.github.com/hopperelec/c23eb872b83b5584122e61a676394ff3#apis
     */
    api: string;
    /**
     * The specific warning data.
     * The structure will vary depending on the API that produced the warning.
     * See: https://gist.github.com/hopperelec/c23eb872b83b5584122e61a676394ff3#apis
     */
    warnings: any;
}

// --- Last Seen Parsing ---

/** Possible states shown in the last seen string provided by the train statuses API. */
export type ActiveTrainState = "Approaching" | "Arrived" | "Ready to start" | "Departed";

/** Valid platform numbers. */
export type PlatformNumber = 1 | 2 | 3 | 4;

/** Parts of the last seen string provided by the train statuses API. */
export type ParsedLastSeen = {
    state: ActiveTrainState;
    station: string;
    platform: PlatformNumber;
    hours: number;
    minutes: number;
}

/** Parts of the location string provided by the times API. */
export type ParsedTimesAPILocation = {
    station: string;
    platform: PlatformNumber;
}
