#ifndef MSOCKET_UDS_H_
#define MSOCKET_UDS_H_

#include <string>

#include "net/base/io_buffer.h"

namespace extensions {

class MSocketUDS {
 public:
  explicit MSocketUDS(const std::string& path);
  ~MSocketUDS();

  // Establish connection to UDS server.
  int Connect();

  // Disconnect and close fd.
  void Disconnect();

  // Whether fd is valid.
  bool IsConnected() const;

  // Fake synchronous read (wrapped).
  int Read(char* buf, int buf_len);

  // Fake synchronous write (wrapped).
  int Write(const char* buf, int buf_len);

 private:
  int sockfd_;
  std::string path_;

  int MapErrno(int e);
};
}  // namespace extensions

#endif  // MSOCKET_UDS_H_
