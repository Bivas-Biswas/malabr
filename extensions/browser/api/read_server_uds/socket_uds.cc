#include "extensions/browser/api/read_server_uds/socket_uds.h"

#include <sys/socket.h>
#include <sys/un.h>

#include "net/base/net_errors.h"

namespace extensions {
  
SocketUDS::SocketUDS(const std::string& path) : sockfd_(-1), path_(path) {}

SocketUDS::~SocketUDS() {
  if (sockfd_ != -1) {
    close(sockfd_);
  }
}

int SocketUDS::Connect() {
  sockfd_ = socket(AF_UNIX, SOCK_STREAM, 0);
  if (sockfd_ == -1) {
    return MapErrno(errno);
  }

  struct sockaddr_un addr;
  memset(&addr, 0, sizeof(addr));
  addr.sun_family = AF_UNIX;
  strncpy(addr.sun_path, path_.c_str(), sizeof(addr.sun_path) - 1);

  if (connect(sockfd_, reinterpret_cast<struct sockaddr*>(&addr),
              sizeof(addr)) == -1) {
    int err = MapErrno(errno);
    close(sockfd_);
    sockfd_ = -1;
    return err;
  }

  return net::OK;
}

void SocketUDS::Disconnect() {
  if (sockfd_ != -1) {
    close(sockfd_);
    sockfd_ = -1;
  }
}

bool SocketUDS::IsConnected() const {
  return sockfd_ != -1;
}

int SocketUDS::Read(char* buf, int buf_len) {
  if (sockfd_ == -1) {
    return net::ERR_CONNECTION_CLOSED;
  }

  int ret = recv(sockfd_, buf, buf_len, 0);
  if (ret >= 0) {
    return ret;
  }
  return MapErrno(errno);
}

int SocketUDS::Write(const char* buf, int buf_len) {
  if (sockfd_ == -1) {
    return net::ERR_CONNECTION_CLOSED;
  }

  int ret = send(sockfd_, buf, buf_len, 0);
  if (ret >= 0) {
    return ret;
  }
  return MapErrno(errno);
}

int SocketUDS::MapErrno(int e) {
  switch (e) {
    case EAGAIN:
    case ECONNRESET:
      return net::ERR_CONNECTION_RESET;
    case ENOTCONN:
      return net::ERR_CONNECTION_CLOSED;
    default:
      return net::ERR_FAILED;
  }
}
}  // namespace extensions
