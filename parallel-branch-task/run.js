const { is, data, any, number, string, union } = require("@algebraic/type");
const { List, Map, Set } = require("@algebraic/collections");
const Task = require("./task");
const Independent = require("./independent");
const KeyPath = require("@algebraic/ast/key-path");
const until = require("@climb/until");
const update = require("@cause/cause/update");


const Isolate = data `Isolate` (
    concurrency =>  number,
    open        =>  List(Task),
    running     =>  Map(string, Task),
    memoized    =>  Map(string, Task),
    finish      =>  Function,
    settle      =>  Function );

const PromiseSettled = data `PromiseSettled` (
    forContentAddress   =>  string,
    completion          =>  Task.Completed );

PromiseSettled.from = (succeeded, forContentAddress, value) =>
    (completion => PromiseSettled({ completion, forContentAddress }))
    (succeeded ? Task.Success({ value }) : Task.Failure.Direct({ value }));


Isolate.update = update

    .on(PromiseSettled, function (isolate, { forContentAddress, completion })
    {console.log("SETTLING " + forContentAddress);
        const memoizations = isolate.memoizations
            .set(forContentAddress, completion);
        const running = isolate.running.remove(forContentAddress);
        const task = until(
            task => !task.runningLeaves.has(forContentAddress),
            task => update.in(
                task,
                [...task.runningLeaves.get(forContentAddress).first()],
                completion)[0],
            isolate.task);

        const x = allot(Isolate({ ...isolate, task, memoizations, running }));
    
        console.log(task, task.runningLeaves.has(forContentAddress), completion);
    
        return x;
    })

    .on(Task.Completed, function (isolate, task)
    {
        return allot(isolate);
    })

module.exports = function run (task)
{
    return new Promise(function (resolve, reject)
    {
        const finish = task =>
            is(Task.Success, task) ?
                resolve(task.value) : reject(task);
        const settle = (succeeded, forContentAddress) => value =>
            isolate = update(isolate,
                PromiseSettled.from(succeeded, forContentAddress, value));

        let isolate = Isolate({ concurrency: 1, task, settle, finish });
console.log(isolate);
        isolate = allot(isolate);
console.log(isolate);
    });
}

async function fromPromiseCall(callee)
{
    return await callee();    
}

// return new isolate and functions to call
/*function (taskRoot, running, concurrency)
{
    const { waitingLeaves } = task;

    // There are no known tasks waiting for resources.
    if (waitingLeaves.size <= 0)
        return isolate;

    // FIXME: Not necessarily true! We might be able to satisfy from memoizations.
    if (isolate.running.size >= isolate.concurrency)
        return isolate;

    // FIXME: Order matters?
    // Make sure to handle other waitings first? In order to simulate happening at the same time?
    const [contentAddress, keyPaths] = waitingLeaves.entrySeq().first();
    const keyPath = keyPaths.get(0);
    const waiting = KeyPath.get(keyPath, task);

    // Should we wait to move this when we confirm it's actually *in* running?
    const runningTask = Independent.Running({ contentAddress });
    const running = isolate.running.set(contentAddress, runningTask);

    // More efficient to store just as keys without keyPaths?
    const taskWithRunningLeaves = until(
        task => !task.waitingLeaves.has(contentAddress),
        task => update.in(
            task,
            [...task.waitingLeaves.get(contentAddress).first()],
            runningTask)[0],
        isolate.task);

    fromPromiseCall(waiting.callee).then(
        isolate.settle(true, contentAddress),
        isolate.settle(false, contentAddress)).catch(e => console.log(e));

    return Isolate({ ...isolate, running, task: taskWithRunningLeaves });
}*/

function allot(isolate)
{
    const { task } = isolate;

    if (is (Task.Completed, task))
        return isolate.finish(task);

    if (

    const { waitingLeaves } = task;

    // There are no known tasks waiting for resources.
    if (waitingLeaves.size <= 0)
        return isolate;

    // FIXME: Not necessarily true! We might be able to satisfy from memoizations.
    if (task.runningLeaves.size >= isolate.concurrency)
        return isolate;

    // FIXME: Order matters?
    // Make sure to handle other waitings first? In order to simulate happening at the same time?
    const [contentAddress, keyPaths] = waitingLeaves.entrySeq().first();
    const keyPath = keyPaths.get(0);
    const waiting = KeyPath.get(keyPath, task);

    // Should we wait to move this when we confirm it's actually *in* running?
    const runningTask = Independent.Running({ contentAddress });
    const running = isolate.running.set(contentAddress, runningTask);

    // More efficient to store just as keys without keyPaths?
    const taskWithRunningLeaves = until(
        task => !task.waitingLeaves.has(contentAddress),
        task => update.in(
            task,
            [...task.waitingLeaves.get(contentAddress).first()],
            runningTask)[0],
        isolate.task);

    const result = invoke(waiting.invocation, isolate);
    const leaf = is (Task.Dependent, result) ?
        Task.Running({ ...result }) :
        result;

    const replaced = until(
        task => !task.waitingLeaves.has(contentAddress),
        task => update.in(
            task,
            [...task.waitingLeaves.get(contentAddress).first()],
            result)[0],
        isolate.task);
    const memoizations = isolate.memoizations
        .set(contentAddress, result);

    return allot(Isolate({ memoizations, running, task: replaced }));
}

function invoke(waiting, isolate)
{
    const { settle, memoizations } = isolate;
    const { name, contentAddress, invocation } = waiting;

    if (memoizations.has(contentAddress))
        return memoizations.get(contentAddress);

    try
    {
        const result = invocation.callee.apply(
            invocation.receiver,
            invocation.arguments.toArray());

        if (is (Task, result))
            return of(result)({ ...result, name });

        if (!isThenable(result))
            return Task.Success({ name, value: result });

        ensureAsyncThen(result).then(
            settle(true, contentAddress),
            settle(false, contentAddress));

        return Task.Running({ name, contentAddress });
    }
    catch (value)
    {
        return Task.Failure.Direct({ name, value });
    }
}

async function ensureAsyncThen(thenable)
{
    return await thenable;
}

function isThenable(value)
{
    return !!value && typeof value.then === "function";
}

// Running is a function of concurrency and previous running?
