export function createJsonlConsumer({ onRecord, onError = () => {} }) {
  let buffer = '';

  function consume(line) {
    const record = line.trim();
    if (!record) return;
    try {
      onRecord(record);
    } catch (error) {
      onError(error, record);
    }
  }

  function drain() {
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      consume(buffer.slice(0, newline));
      buffer = buffer.slice(newline + 1);
    }
  }

  return {
    write(chunk) {
      buffer += chunk;
      drain();
    },
    end() {
      consume(buffer);
      buffer = '';
    }
  };
}
