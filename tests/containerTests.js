/* notice_start
 * Copyright 2016 Dev Shop Limited
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
 notice_end */
 
import microid from '../src';

describe('Container', () =>  {

    var container;

    beforeEach(() => {
        container = new microid.Container();
    });

    describe('.register()/.resolve() functionality', () =>  {

        it('should register/resolve an object with no dependencies', () =>  {
            var Foo = createObject({ bar: { value : 5 }});
            container.register('foo', Foo);
            var foo = container.resolve('foo');
            expect(foo.bar).toBeDefined();
            expect(foo.bar).toBe(5);
        });

        it('should call init with resolving if object has init method', () =>  {
            var Foo = {
                init: function() {
                    this._bar = 5;
                    return this;
                },
                get bar() { return this._bar; }
            };
            container.register('foo', Foo);
            var foo = container.resolve('foo');
            expect(foo.bar).toBeDefined();
            expect(foo.bar).toBe(5);
        });

        it('should register/resolve an object with string named dependencies', () =>  {
            var A = createObject();
            var B = createObject();
            var C = createObject();
            container.register('a', A);
            container.register('b', B).inject('a');
            container.register('c', C).inject('b');
            var c = container.resolve('c');
            expect(c.dependencies.length).toBe(1);
            expect(B.isPrototypeOf(c.dependencies[0])).toBe(true);
        });

        it('should throw if circular dependency detected during .resolve()', () =>  {
            var A = createObject();
            var B = createObject();
            var C = createObject();
            container.register('a', A).inject('b');
            container.register('b', B).inject('a');
            container.register('c', C).inject('b');
            expect(() =>  {
                var b = container.resolve('b');
            }).toThrow();
            expect(() =>  {
                var a = container.resolve('a');
            }).toThrow();
            expect(() =>  {
                var c = container.resolve('c');
            }).toThrow();
        });

        it('should register/resolve a given instance', () =>  {
            var instance = {};
            container.registerInstance('a', instance);
            var resolved = container.resolve('a');
            expect(resolved).toBe(instance);
        });

        it('should throw if resolving an unregistered instance', () =>  {
            expect(() => {
                container.resolve('a');
            }).toThrow(new Error('Nothing registered for dependency [a]'));
        });

        it('should pass additional dependencies to object being  resolved', () =>  {
            var A = createObject();
            container.register('a', A);
            var resolved = container.resolve('a', "Foo", "Bar");
            expect(resolved.dependencies.length).toEqual(2);
            expect(resolved.dependencies[0]).toEqual("Foo");
            expect(resolved.dependencies[1]).toEqual("Bar");
        });

        describe('groups', () =>  {

            it('should be able able to register/resolve many objects with the same key', () =>  {
                var A = createObject();
                var B = createObject();
                container.register('a', A).inGroup('myGroup');
                container.register('b', B).inject('a').inGroup('myGroup');
                var group = container.resolveGroup('myGroup');
                expect(A.isPrototypeOf(group[0])).toEqual(true);
                expect(B.isPrototypeOf(group[1])).toEqual(true);
            });

            it('should throw if item already registered in group', () =>  {
                var A = createObject();
                expect(() => {
                    container
                        .register('a', A)
                        .inGroup('myGroup')
                        .inGroup('myGroup');
                }).toThrow();
            });

            it('should resolve group instances in the same order they were registered', () => {
                var N_OBJS = 5;
                for(var i=0; i<N_OBJS; i++){
                    var Obj = createObject({index: {value : i}});
                    container.register('object-' + i, Obj)
                        .inGroup('foo');
                }

                var objs = container.resolveGroup('foo');
                expect(objs.length).toBe(N_OBJS);
                for(var i=0; i<N_OBJS; i++){
                    expect(objs[i].index).toBe(i);
                }
            });

            it('should respect the instance lifetime settings when resolving', () =>  {
                var A = createObject();
                var B = createObject();
                container.register('a', A)
                    .transient()
                    .inGroup('myGroup');
                container.register('b', B)
                    .inject('a')
                    .singleton()
                    .inGroup('myGroup');
                var group1 = container.resolveGroup('myGroup');
                var group2 = container.resolveGroup('myGroup');

                expect(group1[0]).not.toBe(group2[0]); // registration 'a' is transient so we should get a new one each time
                expect(group1[1]).toBe(group2[1]); // registration 'b' is singleton so we should get the same one each time

                // the 'a' resolved as part of the group should be different as that given to 'b' as a dependency
                expect(A.isPrototypeOf(group1[0])).toBe(true);
                expect(A.isPrototypeOf(group1[1].dependencies[0])).toBe(true);
                expect(group1[0]).not.toBe(group1[1].dependencies[0]);
            });
        });

        describe('constructor functions', () =>  {
            it('should register/resolve functions with new', () =>  {
                var Foo = createFunction();
                var Bar = createFunction();
                container.register('foo', Foo);
                container.register('bar', Bar).inject('foo');
                var bar = container.resolve('bar');
                var foo = container.resolve('foo');
                expect(bar.dependencies[0]).toBe(foo);
            });
        });

        describe('dependency resolvers', () =>  {

            it('should register/resolve a dependency registered with a dependency key delegate resolver', () =>  {
                var A = createObject();
                container.register('a', A).inject({
                    resolver: "delegate",
                    resolve: function()
                    {
                        return { foo: 6 };
                    }
                });
                var a = container.resolve('a');
                expect(a.dependencies[0].foo).toBe(6);
            });

            it('should register/resolve a dependency registered with delegate resolver', () =>  {
                var A = createObject();
                container.register('a', {
                    resolver: "delegate",
                    resolve: () => {
                        return Object.create(A);
                    },
                    isResolverKey: true
                });
                var a = container.resolve('a');
                expect(A.isPrototypeOf(a)).toEqual(true);
            });

            describe('auto factory dependency resolve', () =>  {
                var A, B, C, factoryForA, factoryForB;

                beforeEach(() => {
                    A = createObject();
                    B = createObject();
                    C = createObject();
                    container.register('a', A); // singleton by default
                    container.register('b', B).inject('a').transient();
                    container.register('c', C).inject({
                        resolver: "factory",
                        key: 'a' // resolve 'a' each time the injected function is called
                    }, {
                        resolver: "factory",
                        key: 'b' // resolve 'b' each time the injected function is called
                    });
                    var c = container.resolve('c');
                    factoryForA = c.dependencies[0];
                    factoryForB = c.dependencies[1];
                });

                it('should resolve an instance each time the auto factory is invoked', () =>  {
                    var b1 = factoryForB(), b2 = factoryForB(), b3 = factoryForB();
                    expect(B.isPrototypeOf(b1)).toEqual(true);
                    expect(B.isPrototypeOf(b2)).toEqual(true);
                    expect(B.isPrototypeOf(b3)).toEqual(true);
                    expect(b1 != b2).toEqual(true); // transient registration so the instances should be different
                    expect(b2 != b3).toEqual(true);
                });

                it('should pass additional dependencies to the constructor on the instance being resolved', () =>  {
                    var b1 = factoryForB("aParam", "anotherParam");
                    expect(b1.dependencies.length).toEqual(3);
                    expect(A.isPrototypeOf(b1.dependencies[0])).toEqual(true);
                    expect(b1.dependencies[1]).toEqual("aParam");
                    expect(b1.dependencies[2]).toEqual("anotherParam");
                });

                it('should throw if parameters passed and the resolve targetsingletonlton and already built', () =>  {
                    var a1 = factoryForA("aParam", "anotherParam");
                    expect(() => {
                        var a2 = factoryForA("aParam", "anotherParam");
                    }).toThrow();
                });

            });

            it('should pass container to dependency resolver', () =>  {
                pending();
            });

            it('should throw if register called with unknown plugin', () =>  {
                pending();
            });

            it('should resolve from custom resolvers', () =>  {
                pending();
            });
        });

        describe('lifetime management', () =>  {
            it('should register/resolve a new instance each time if transiently registered', () =>  {
                var A = createObject();
                container.register('a', A).transient();
                var a1 = container.resolve('a');
                var a2 = container.resolve('a');
                expect(a1).not.toBe(a2);
            });

            it('should register/resolve the same instance if registered as singleton', () =>  {
                var A = createObject();
                container.register('a', A).singleton();
                var a1 = container.resolve('a');
                var a2 = container.resolve('a');
                expect(a1).toBe(a2);
            });
        });
    });

    describe('.createChildContainer()', () =>  {

        it('should throw if called with arguments', () =>  {
            pending();
        });

        describe('.register()/.resolve() ', () =>  {

            it('should default to resolving from parent when no configuration override exists in the child', () =>  {
                var A = createObject();
                container.register('a', A);
                var childContainer = container.createChildContainer();
                var a = childContainer.resolve('a');
                expect(A.isPrototypeOf(a)).toBe(true);
            });

            it('should register singleton instances with the container that owns the registration', () =>  {
            	// this is an interesting edge case whereby if the root container owns the singleton registration
                // yet it's first resolved by a child, then the cached instance should belong in the parent
                var A = createObject();
                container.register('a', A).singleton();
                var childContainer = container.createChildContainer();
                var c2a = childContainer.resolve('a');
                var c1a = container.resolve('a');
                expect(c2a).toBe(c1a);
            });

            describe('groups', () =>  {
                var A, B;

                beforeEach(() => {
                    A = createObject();
                    B = createObject();
                    container.register('a', A).singleton().inGroup('myGroup');
                    container.register('b', B).singleton().inGroup('myGroup');
                });

                it('should resolve group from parent when no configuration override exists in the child ', () =>  {
                    var childContainer = container.createChildContainer();
                    var childGroup = childContainer.resolveGroup('myGroup');
                    var rootGroup = container.resolveGroup('myGroup');
                    // here the group resolved from the child should match the parent as
                    // the group wasn't overridden in the child
                    expect(childGroup[0]).toBe(rootGroup[0]);
                    expect(childGroup[1]).toBe(rootGroup[1]);
                });

                it('should resolve group from child when configuration override exists in the child', () =>  {
                    var childContainer = container.createChildContainer();
                    // reconfigure the child container
                    childContainer.register('a', A).singleton().inGroup('myGroup');
                    childContainer.register('b', B).singleton().inGroup('myGroup');
                    var childGroup = childContainer.resolveGroup('myGroup');
                    var rootGroup = container.resolveGroup('myGroup');
                    // the two groups should be different as the registration was overridden in the child
                    expect(childGroup[0]).not.toBe(rootGroup[0]);
                    expect(childGroup[1]).not.toBe(rootGroup[1]);
                });
            });
        });

        describe('registration overrides', () =>  {
            it('should resolve from child when parent registration overridden', () =>  {
                var A = createObject();
                var B = createObject();
                container.register('a', A);
                container.register('b', B);
                var childContainer = container.createChildContainer();
                // override 'a' configuration to make it take 'b' as a dependency.
                childContainer.register('a', A).inject('b');
                var a1 = container.resolve('a');
                var a2 = childContainer.resolve('a');
                expect(a1).not.toBe(a2);
                expect(a1.dependencies.length).toBe(0);
                expect(a2.dependencies.length).toBe(1);
            });

            it('should resolve a transient instance when a child container overrides a parents singleton registration', () =>  {
                var B = createObject();
                container.register('b', B).singleton();
                var b1 = container.resolve('b');
                var childContainer = container.createChildContainer();
                childContainer.register('b', B).transient();
                var b2 = childContainer.resolve('b');
                expect(b1).not.toBe(b2);
                var b3 = childContainer.resolve('b');
                expect(b2).not.toBe(b3);
                var b4 = container.resolve('b');
                expect(b1).toBe(b4);
            });
        });

        describe('lifetime management', () =>  {

            it('should register/resolve the same instance per container if registered as singletonPerContainer', () =>  {
                var A = createObject();
                container.register('a', A).singletonPerContainer();
                var childContainer = container.createChildContainer();
                var a1 = container.resolve('a');
                var a2 = container.resolve('a');
                var b1 = childContainer.resolve('a');
                var b2 = childContainer.resolve('a');
                expect(a1).toBe(a2);
                expect(b1).toBe(b2);
                expect(a1).not.toBe(b1);
            });

        });

        describe('dependency resolvers', () =>  {
            it('should resolve from child dependency resolver when parent registration overridden', () =>  {
                var CustomResolver = {
                    init: function(id) {
                        this.id = id;
                        return this;
                    },
                    resolver: "myResolver",
                    resolve: function(container) {
                        return this.id;
                    }
                };

                var A = createObject();
                container.addResolver("myResolver", Object.create(CustomResolver).init("container1Resolver"));
                container.register('a', A).inject({ resolver: "myResolver" }).singleton();

                var childContainer = container.createChildContainer();
                // replace the parent containers resolver
                childContainer.addResolver("myResolver", Object.create(CustomResolver).init("container2Resolver"));
                // you must also override the objects registration if it's a singleton otherwise
                // the container will just delegate to the root for resolution as that's whats owns the registration
                childContainer.register('a', A).inject({ resolver: "myResolver" }).singleton();

                var a1 = container.resolve('a');
                expect(a1.dependencies[0]).toBe("container1Resolver");
                var a2 = childContainer.resolve('a');
                expect(a2.dependencies[0]).toBe("container2Resolver");
            });
        });

        describe('resolving objects that have injected containers from within child containers', () =>  {
            it('should return the same container that is resolving the object in question', () =>  {
                var A = createObject();
                container.register('a', A)
                    .transient()
                    .inject(microid.MicroDiConsts.owningContainer);

                var a1 = container.resolve('a');
                expect(a1.dependencies[0]).toBe(container);

                var childContainer_1 = container.createChildContainer();
                var a1_1 = childContainer_1.resolve('a');
                expect(a1_1.dependencies[0]).toBe(childContainer_1);

                var a2 = container.resolve('a');
                expect(a2.dependencies[0]).toBe(container);

                var childContainer_2 = container.createChildContainer();
                var a1_2 = childContainer_2.resolve('a');
                expect(a1_2.dependencies[0]).toBe(childContainer_2);
            });
        });
    });

    describe('.dispose() container', () =>  {

        function createDisposable() {
            return createObject({
                isDisposed: {
                    get: function() { return this._isDisposed || false;},
                    set: function(value) { this._isDisposed = value; }
                },
                dispose: { value: function() { this._isDisposed = true; }}
            });
        }

        it('should dispose all singleton objects on container dispose', () =>  {
            var A = createDisposable();
            container.register('a', A).singleton();
            var a1 = container.resolve('a');
            container.dispose();
            expect(a1.isDisposed).toBe(true);
        });

        it('should not dispose transient objects on container dispose', () =>  {
            var A = createDisposable();
            container.register('a', A).transient();
            var a1 = container.resolve('a');
            container.dispose();
            expect(a1.isDisposed).toBe(false);
        });

        it('should not dispose external objects on container dispose', () =>  {
            var A = createDisposable();
            // registerInstance has an external lifetime type
            container.registerInstance('a1', Object.create(A).init());
            container.registerInstance('a2', Object.create(A).init(), true);
            var a1 = container.resolve('a1');
            var a2 = container.resolve('a2');
            container.dispose();
            expect(a1.isDisposed).toBe(false);
            expect(a2.isDisposed).toBe(false);
        });

        it('should dispose registered instance when their lifetime type was explicitly provided', () =>  {
            var A = createDisposable();
            container.registerInstance('a', Object.create(A).init(), false);
            var a1 = container.resolve('a');
            container.dispose();
            expect(a1.isDisposed).toBe(true);
        });

        it('should dispose singletonPerContainer instance only in the child container that was disposed', () =>  {
            var A = createDisposable();
            container.register('a', A).singletonPerContainer();
            var childContainer = container.createChildContainer();
            var a = container.resolve('a');
            var a1 = childContainer.resolve('a');
            childContainer.dispose();
            expect(a.isDisposed).toBe(false);
            expect(a1.isDisposed).toBe(true);
        });

        it('should not resolve new instances once disposed', () =>  {
            var A = createDisposable();
            container.register('a', A);
            container.dispose();
            expect(() =>  {
                container.resolve('a');
            }).toThrow(new Error("Container has been disposed"));
        });

        it('should dispose child container on parent container dispose', () =>  {
            var A = createDisposable();
            var B = createDisposable();
            container.register('a', A);
            var childContainer = container.createChildContainer();
            childContainer.register('b', B);
            var a = container.resolve('a');
            var b = childContainer.resolve('b');
            container.dispose();
            expect(a.isDisposed).toBe(true);
            expect(b.isDisposed).toBe(true);
        });

        it('should not resolve new instance from child once parent is disposed', () =>  {
            var A = createDisposable();
            var childContainer = container.createChildContainer();
            childContainer.register('a', A);
            container.dispose();
            expect(() =>  {
                childContainer.resolve('a');
            }).toThrow(new Error("Container has been disposed"));
        });

        it('should not dispose parent on child container dispose', () =>  {
            var A = createDisposable();
            var B = createDisposable();
            container.register('a', A);
            var childContainer = container.createChildContainer();
            childContainer.register('b', B);
            var a = container.resolve('a');
            var b = childContainer.resolve('b');
            childContainer.dispose();
            expect(a.isDisposed).toBe(false);
            expect(b.isDisposed).toBe(true);
        });

        it('should still be able to resolve from parent on child container dispose', () =>  {
            var A = createDisposable();
            container.register('a', A).singletonPerContainer();
            var childContainer = container.createChildContainer();
            var a = container.resolve('a');
            var a1 = childContainer.resolve('a');
            childContainer.dispose();
            expect(a.isDisposed).toBe(false);
            expect(a1.isDisposed).toBe(true);
            var a2 = container.resolve('a');
            expect(a2.isDisposed).toBe(false);
        });
    });

    describe('Should return isRegistered', () => {
        it('Should return true when a key is registered', () => {
            container.register('a', {}).singleton();
            var isRegistered = container.isRegistered('a');
            expect(isRegistered).toBe(true);
        });

        it('Should return false when a key is not registered', () => {
            container.register('a', {}).singleton();
            var isRegistered = container.isRegistered('b');
            expect(isRegistered).toBe(false);
        });
    })

    describe('incorrect argument handling', () =>  {

        it('throws if arguments incorrect for .register()', () => {
            let keyError = new Error('MicroDi: Error calling register(name, proto). The name argument must be a string and can not be \'\'');
            expect(() => {container.register(); }).toThrow(keyError);
            expect(() => {container.register(undefined, {}); }).toThrow(keyError);
            expect(() => {container.register('', {}); }).toThrow(keyError);
            expect(() => {container.register(null, {}); }).toThrow(keyError);
            expect(() => {container.register({}, {}); }).toThrow(keyError);

            let registrationError = new Error('MicroDi: Error calling register(name, proto). Registered item for [foo] can not be null or undefined');
            expect(() => {container.register('foo', undefined); }).toThrow(registrationError);
            expect(() => {container.register('foo', null); }).toThrow(registrationError);

            expect(() => {container.register('foo', 1); }).toThrow(new Error('MicroDi: Error calling register(name, proto). Can not register a number instance against key [foo], use registerInstance(name, instance)'));
            expect(() => {container.register('foo', 'aString'); }).toThrow(new Error('MicroDi: Error calling register(name, proto). Can not register a string instance against key [foo], use registerInstance(name, instance)'));
        });

        it('should not throw if .register() called with existing registration key', () =>  {
            // you should be allowed to override a registration
            let A = createObject();
            container.register('foo', A);
            let B = createObject();
            container.register('foo', B);
            let b = container.resolve('foo');
            expect(B.isPrototypeOf(b)).toEqual(true);
        });

        it('throws if arguments incorrect for .registerInstance()', () => {
            let keyError = new Error('MicroDi: Error calling register(name, instance, isExternallyOwned = true). The name argument must be a string and can not be \'\'');
            expect(() => {container.registerInstance(); }).toThrow(keyError);
            expect(() => {container.registerInstance(undefined, {}); }).toThrow(keyError);
            expect(() => {container.registerInstance('', {}); }).toThrow(keyError);
            expect(() => {container.registerInstance(null, {}); }).toThrow(keyError);
            expect(() => {container.registerInstance({}, {}); }).toThrow(keyError);

            let registrationError = new Error('MicroDi: Error calling registerInstance(name, instance, isExternallyOwned = true). Provided instance for [foo] can not be null or undefined');
            expect(() => {container.registerInstance('foo', undefined); }).toThrow(registrationError);
            expect(() => {container.registerInstance('foo', null); }).toThrow(registrationError);
        });

        it('throws if arguments incorrect for .resolve()', () => {
            let keyError = new Error('MicroDi: Error calling resolve(name, ...additionalDependencies). The name argument must be a string and can not be \'\'');
            expect(() => {container.resolve(); }).toThrow(keyError);
            expect(() => {container.resolve(undefined); }).toThrow(keyError);
            expect(() => {container.resolve(''); }).toThrow(keyError);
            expect(() => {container.resolve(null); }).toThrow(keyError);
            expect(() => {container.resolve({}, {}); }).toThrow(keyError);
        });

        it('throws if arguments incorrect for .resolveGroup()', () => {
            let keyError = new Error('MicroDi: Error calling resolveGroup(groupName). The groupName argument must be a string and can not be \'\'');
            expect(() => {container.resolveGroup(); }).toThrow(keyError);
            expect(() => {container.resolveGroup(undefined); }).toThrow(keyError);
            expect(() => {container.resolveGroup(''); }).toThrow(keyError);
            expect(() => {container.resolveGroup(null); }).toThrow(keyError);
            expect(() => {container.resolveGroup({}); }).toThrow(keyError);
        });

        it('throws if arguments incorrect for .addResolver()', () => {
            let resolver = () => {};
            let keyError = new Error('MicroDi: Error calling addResolver(name, resolver). The name argument must be a string and can not be \'\'');
            expect(() => {container.addResolver(); }).toThrow(keyError);
            expect(() => {container.addResolver(undefined); }).toThrow(keyError);
            expect(() => {container.addResolver(''); }).toThrow(keyError);
            expect(() => {container.addResolver(null); }).toThrow(keyError);
            expect(() => {container.addResolver({}); }).toThrow(keyError);

            let registrationError = new Error('MicroDi: Error calling addResolver(name, resolver). Provided resolver for [foo] can not be null or undefined');
            expect(() => {container.addResolver('foo'); }).toThrow(registrationError);
            expect(() => {container.addResolver('foo', undefined); }).toThrow(registrationError);
            expect(() => {container.addResolver('foo', null); }).toThrow(registrationError);
        });

        it('throws if arguments incorrect for .isRegistered()', () => {
            let keyError = new Error('MicroDi: Error calling isRegistered(name). The name argument must be a string and can not be \'\'');
            expect(() => {container.isRegistered(); }).toThrow(keyError);
            expect(() => {container.isRegistered(undefined); }).toThrow(keyError);
            expect(() => {container.isRegistered(''); }).toThrow(keyError);
            expect(() => {container.isRegistered(null); }).toThrow(keyError);
            expect(() => {container.isRegistered({}); }).toThrow(keyError);
        });

        it('should throw if .inGroup() called with incorrect arguments', () =>  {
            let inGroupKeyError = new Error('MicroDi: Error calling inGroup(groupName). The name argument must be a string and can not be \'\'');
            expect(() => { container.register('foo', {}).inGroup(); }).toThrow(inGroupKeyError);
            expect(() => { container.register('foo', {}).inGroup(undefined); }).toThrow(inGroupKeyError);
            expect(() => { container.register('foo', {}).inGroup(''); }).toThrow(inGroupKeyError);
            expect(() => { container.register('foo', {}).inGroup(null); }).toThrow(inGroupKeyError);
            expect(() => { container.register('foo', {}).inGroup({}); }).toThrow(inGroupKeyError);
        });
    });

    function createObject(props) {
        var o = Object.create(Object.prototype, {
                init : {
                    value: function() {
                        this.dependencies = Array.prototype.slice.call(arguments);
                        return this;
                    }
                }
            }
        );

        if(props !== undefined)  Object.defineProperties(o, props);

        return o;
    }

    function createFunction() {
        function AFunction() {
            this.dependencies = Array.prototype.slice.call(arguments);
        }
        return AFunction;
    }
});