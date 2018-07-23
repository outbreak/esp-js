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

import {Observable} from './Observable';
import {Guard} from '../system';
import {Router} from '../router';

export interface RouterObservable<T> extends Observable<T> {
    streamFor?(modelId: string): RouterObservable<T>;
    subscribeOn?(modelId: string): RouterObservable<T>;
}

export class RouterObservable<T> extends Observable<T> implements RouterObservable<T> {
    protected _router: Router;
    constructor(router: Router, subscribe) {
        Guard.isDefined(router, 'router must be defined');
        Guard.isDefined(subscribe, 'subscribe must be defined');
        super(subscribe);
        this._router = router;
    }
}