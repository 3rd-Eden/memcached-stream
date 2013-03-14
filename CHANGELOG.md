### 0.0.2
- The parser method is now compiled from a function so we can add instrumention
  in to for testing purposes without creating overhead for real world usage
- Various of internal Bytes remaining fixes.
- `setEncoding` should now be added automatically if the source stream didn't
  set it

### 0.0.1
- Various of fixes to the internal bytesRemaining #5
- Small performance improvements
- Added missing `parser#reset` API
- Moved the response fuzzer to it's own module

### 0.0.0
- initial release
