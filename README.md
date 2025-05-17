# What's the distinguishing factor of this thing?

It builds on top of any of the other Promise implementations.

It can wrap any promise implementation and add support of synchronous status
checks and value extraction.

So it means you can take any other working implementation of promises in any
context whether it's workers, deno, bun, node, firefox, chromium or something
else. If it has at least 1 working promises implementation, you can wrap it and
get access to .result, .error, .status and other fields synchronously.
