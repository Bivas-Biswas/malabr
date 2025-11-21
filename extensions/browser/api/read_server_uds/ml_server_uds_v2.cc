#include "extensions/browser/api/read_server_uds/ml_server_uds_v2.h"

#include <arpa/inet.h>

#include <string>

#include "extensions/browser/api/read_server_uds/socket_uds.h"
#include "net/base/net_errors.h"

namespace extensions {

MLServerUDSV2::MLServerUDSV2(const std::string& socket_path,
                             const std::string& label)
    : socket_path_(socket_path), label_(label), weak_ptr_factory_(this) {}

MLServerUDSV2::~MLServerUDSV2() {
  LOG(INFO) << "MLServerUDSV2 destroyed";
}

int MLServerUDSV2::Send(const char* payload,
                        const size_t payload_size,
                        const std::string fb_file_identifier,
                        std::string& response,
                        std::string& error_msg) {
  base::FilePath path(socket_path_);
  SocketUDS socket(path.value());

  // ---- 1. Connect ----
  int result = socket.Connect();
  if (result != net::OK) {
    error_msg = "Connect failed: " + std::to_string(result);
    LOG(ERROR) << error_msg;
    return result;
  }
  LOG(INFO) << "Socket Connected";

  // ---- 2. Send header ----
  std::string header_payload =
      GetHeaderPayload(payload_size, fb_file_identifier);
  if (!WriteExact(socket, header_payload.data(), header_payload.size(),
                  error_msg)) {
    return -1;
  }
  LOG(INFO) << "Header write done! " << header_payload.size();

  // ---- 3. Send payload ----
  if (!WriteExact(socket, payload, payload_size, error_msg)) {
    return -1;
  }
  LOG(INFO) << "Payload write done! " << payload_size;

  // ---- 4. Read response length prefix (4 bytes) ----
  uint32_t response_len = 0;
  if (!ReadExact(socket, reinterpret_cast<char*>(&response_len),
                 sizeof(response_len), error_msg)) {
    return -1;
  }
  response_len = ntohl(response_len);
  LOG(INFO) << "Expecting response of length " << response_len;

  // ---- 5. Read response body ----
  std::string response_accum(response_len, '\0');
  if (!ReadExact(socket, response_accum.data(), response_len, error_msg)) {
    return -1;
  }

  response = std::move(response_accum);
  LOG(INFO) << "Response Read done! " << response;

  return static_cast<int>(response.size());
}

bool MLServerUDSV2::WriteExact(SocketUDS& socket,
                               const char* data,
                               size_t size,
                               std::string& error_msg) {
  size_t total_written = 0;
  while (total_written < size) {
    int written = socket.Write(data + total_written, size - total_written);
    if (written <= 0) {
      error_msg = "Write failed at offset " + std::to_string(total_written) +
                  " with result " + std::to_string(written);
      LOG(ERROR) << error_msg;
      return false;
    }
    total_written += written;
  }
  return true;
}

bool MLServerUDSV2::ReadExact(SocketUDS& socket,
                              char* buffer,
                              size_t size,
                              std::string& error_msg) {
  size_t total_read = 0;
  while (total_read < size) {
    int r = socket.Read(buffer + total_read, size - total_read);
    if (r <= 0) {
      error_msg = "Read failed at offset " + std::to_string(total_read) +
                  " with result " + std::to_string(r);
      LOG(ERROR) << error_msg;
      return false;
    }
    total_read += r;
  }
  return true;
}

std::string MLServerUDSV2::GetHeaderPayload(size_t payload_size,
                                            std::string fb_file_identifier) {
  // 1. Construct the header string
  std::string header =
      fb_file_identifier + "," + label_ + "," + std::to_string(payload_size);

  // 2. Compute its length
  uint32_t header_len = static_cast<uint32_t>(header.size());

  // 3. Convert length to network byte order (big endian)
  uint32_t header_len_net = htonl(header_len);

  // 4. Build final output: 4-byte length prefix + header
  std::string out;
  out.reserve(sizeof(header_len_net) + header.size());
  out.append(reinterpret_cast<const char*>(&header_len_net),
             sizeof(header_len_net));
  out.append(header);

  return out;
}

}  // namespace extensions
