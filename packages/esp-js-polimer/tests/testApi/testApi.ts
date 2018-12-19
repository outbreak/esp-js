import {Router, ObservationStage} from 'esp-js';
import {defaultStoreFactory, EventConst, ReceivedEvent, TestEvent, TestState, TestStore} from './testStore';
import {TestStateHandlerMap, TestStateObjectHandler, TestStateObject} from './stateHandlers';
import {PolimerModel, PolimerStoreBuilder, Store} from '../../src';
import {StorePostEventProcessor, StorePreEventProcessor} from '../../src/eventProcessors';

export interface PolimerTestApi {
    actor: {
        publishEvent(eventType: string),
        publishEventWhichCommitsAtNormalStage<TKey extends keyof TestStore>(eventType: string, stateNameWhichDoesTheCommit: TKey),
    };
    model: PolimerModel<TestStore>;
    asserts: {
        handlerMapState: StateAsserts,
        handlerObjectState: StateAsserts,
        handlerModelState: StateAsserts,
    };
}

export class ReceivedEventAsserts {
    constructor(private _parent: ReceivedEventsAsserts,  private _receivedEvent: ReceivedEvent) {

    }
    public is(eventType: string, event: TestEvent, stage: ObservationStage): this {
        this.typeIs(eventType);
        this.eventIs(event);
        this.observationStageIs(stage);
        return this;
    }
    public typeIs(eventType: string): this {
        expect(this._receivedEvent.eventType).toEqual(eventType);
        return this;
    }
    public eventIs(event: TestEvent): this {
        expect(this._receivedEvent.event).toBe(event);
        return this;
    }
    public observationStageIs(stage: ObservationStage): this {
        expect(this._receivedEvent.observationStage).toEqual(stage);
        return this;
    }
    public end(): ReceivedEventsAsserts {
        return this._parent;
    }
}

export class ReceivedEventsAsserts {
    constructor(private _parent: StateAsserts, private _receivedEvents: ReceivedEvent[]) {

    }
    public eventCountIs(expectedLength: number): this {
        expect(this._receivedEvents.length).toEqual(expectedLength);
        return this;
    }
    public event(receivedAtIndex: number): ReceivedEventAsserts {
        return new ReceivedEventAsserts(this, this._receivedEvents[receivedAtIndex]);
    }
    public end(): StateAsserts {
        return this._parent;
    }
}

export class StateAsserts {
    private _lastState: TestState;
    constructor(private _stateGetter: () => TestState) {

    }
    private get _state() {
        return this._stateGetter();
    }
    public captureCurrentState(): this {
        this._lastState = this._stateGetter();
        return this;
    }
    public stateInstanceHasChanged(): this {
        // preconditions
        expect(this._lastState).toBeDefined();
        const currentState = this._stateGetter();
        expect(this._lastState).toBeDefined();
        expect(this._lastState).not.toBe(currentState);
        return this;
    }
    public previewEvents(): ReceivedEventsAsserts {
        return new ReceivedEventsAsserts(this, this._state.receivedEventsAtPreview);
    }
    public normalEvents(): ReceivedEventsAsserts {
        return new ReceivedEventsAsserts(this, this._state.receivedEventsAtNormal);
    }
    public committedEvents(): ReceivedEventsAsserts {
        return new ReceivedEventsAsserts(this, this._state.receivedEventsAtCommitted);
    }
    public finalEvents(): ReceivedEventsAsserts {
        return new ReceivedEventsAsserts(this, this._state.receivedEventsAtFinal);
    }
}

export class PolimerTestApiBuilder {
    private _useHandlerMap: boolean;
    private _useHandlerObject: boolean;
    private _useHandlerModel: boolean;
    private _preEventProcessor?: StorePreEventProcessor<TestStore>;
    private _postEventProcessor?: StorePostEventProcessor<TestStore>;

    public static create(): PolimerTestApiBuilder {
        return new PolimerTestApiBuilder();
    }

    public withPreEventProcessor(preEventProcessor?: StorePreEventProcessor<TestStore>): this {
        this._preEventProcessor = preEventProcessor;
        return this;
    }

    public withPostEventProcessor(postEventProcessor?: StorePostEventProcessor<TestStore>): this {
        this._postEventProcessor = postEventProcessor;
        return this;
    }

    public withStateHandlerMap() {
        this._useHandlerMap = true;
        return this;
    }

    public withStateHandlerObject() {
        this._useHandlerObject = true;
        return this;
    }

    public withStateHandlerModel() {
        this._useHandlerModel = true;
        return this;
    }

    public build(): PolimerTestApi {
        let router = new Router();
        let modelId = 'modelId';
        let initialStore = defaultStoreFactory(modelId);
        let builder: PolimerStoreBuilder<TestStore>  = router
            .storeBuilder<TestStore>()
            .withInitialStore(initialStore);
        if (this._useHandlerMap) {
            builder.withStateHandlerMap('handlerMapState', TestStateHandlerMap);
        }
        if (this._useHandlerObject) {
            builder.withStateHandlerObject('handlerObjectState', new TestStateObjectHandler());
        }
        if (this._useHandlerModel) {
            let testStateObject = new TestStateObject(modelId, router);
            builder.withStateHandlerModel('handlerModelState', testStateObject);
            testStateObject.initialise();
        }
        if (this._preEventProcessor) {
            builder.withPreEventProcessor(this._preEventProcessor);
        }
        if (this._postEventProcessor) {
            builder.withPostEventProcessor(this._postEventProcessor);
        }
        let model = builder.registerWithRouter();
        // TestStateObject is a classic esp model, it is modeled here to have a typical external lifecycle and manages it's state internally
        let currentStore: TestStore;
        router.getModelObservable<PolimerModel<TestStore>>(modelId).map(m => m.getStore()).subscribe(store => {
            currentStore = store;
        });
        return {
            actor: {
                publishEvent(eventType: string) {
                    let event = {};
                    router.publishEvent(modelId, eventType, event);
                    return event;
                },
                publishEventWhichCommitsAtNormalStage<TKey extends keyof TestStore>(eventType: string, stateNameWhichDoesTheCommit: TKey) {
                    let testEvent = <TestEvent>{ shouldCommit: true, commitAtStage: ObservationStage.normal, stateTakingAction: stateNameWhichDoesTheCommit};
                    router.publishEvent(modelId, eventType, testEvent);
                    return testEvent;
                }
            },
            model,
            asserts: {
                handlerMapState: new StateAsserts(() => currentStore.handlerMapState),
                handlerObjectState: new StateAsserts(() => currentStore.handlerObjectState),
                handlerModelState: new StateAsserts(() => currentStore.handlerModelState),
            }
        };
    }
}