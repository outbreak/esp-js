// notice_start
/*
 * Copyright 2015 Dev Shop Limited
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// notice_end

import {ObservationStage, Consts} from '../router';
import EspDecoratorMetadata from './espDecoratorMetadata';
import { Guard, utils } from '../system';

export let DecoratorTypes = {
    observeEvent: 'observeEvent',
    observeModelChangedEvent: 'observeModelChangedEvent'
};

export interface ObserveEventPredicate {
    (model: any, event: any): boolean;
}

export function observeEvent(eventName: string);
export function observeEvent(eventName: string, observationStage: ObservationStage);
export function observeEvent(eventName: string, predicate: ObserveEventPredicate);
export function observeEvent(eventName: string, observationStage: ObservationStage, predicate: ObserveEventPredicate);
export function observeEvent(...args: any[]) {
    return function (target, name, descriptor) {
        let eventName1, observationStage1, predicate1;
        if(args.length >= 0) {
            eventName1 = args[0];
        }
        if(args.length >= 1) {
            if(utils.isString(args[1])) {
                observationStage1 = args[1];
            } else if (utils.isFunction(args[1])) {
                predicate1 = args[1];
            }
        }
        if(!predicate1 && args.length >= 2) {
            predicate1 = args[2];
        }
        if (eventName1 === Consts.modelChangedEvent) {
            throw new Error(`Can not use observeEvent to observe the ${Consts.modelChangedEvent} on function target ${name}. Use the observeModelChangedEvent decorator instead`);
        }
        Guard.isString(eventName1, 'eventName passed to an observeEvent decorator must be a string');
        Guard.isTrue(eventName1 !== '', 'eventName passed to an observeEvent decorator must not be \'\'');
        if(observationStage1) {
            Guard.isString(observationStage1, 'observationStage passed to an observeEvent decorator must be a string');
            Guard.isTrue(observationStage1 !== '', 'observationStage passed to an observeEvent decorator must not be \'\'');
        }
        if(predicate1) {
            Guard.isFunction(predicate1, 'predicate passed to an observeEvent decorator must be a function');
        }
        let metadata = EspDecoratorMetadata.getOrCreateMetaData(target.constructor);
        metadata.addEvent(
            name,
            eventName1,
            DecoratorTypes.observeEvent,
            observationStage1,
            predicate1
        );
        return descriptor;
    };
}

export function observeModelChangedEvent(modelId) {
    return function (target, name, descriptor) {
        let metadata = EspDecoratorMetadata.getOrCreateMetaData(target.constructor);
        metadata.addEvent(
            name,
            Consts.modelChangedEvent,
            DecoratorTypes.observeModelChangedEvent,
            ObservationStage.normal,
            null,
            modelId
        );
        return descriptor;
    };
}