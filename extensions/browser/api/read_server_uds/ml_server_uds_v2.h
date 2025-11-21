#ifndef EXTENSIONS_BROWSER_API_READ_SERVER_UDS_ML_SERVER_UDS_V2_H_
#define EXTENSIONS_BROWSER_API_READ_SERVER_UDS_ML_SERVER_UDS_V2_H_

#include <memory>
#include <string>

#include "base/memory/weak_ptr.h"
#include "extensions/browser/api/read_server_uds/socket_uds.h"
#include "net/base/io_buffer.h"

namespace extensions {

class MLServerUDSV2 {
 public:
  MLServerUDSV2(const std::string& socket_path, const std::string& label);
  ~MLServerUDSV2();

  int Send(const char* payload,
           const size_t payload_size,
           const std::string fb_file_identifier,
           std::string& response,
           std::string& error_msg);

  void Clear();

 private:
  std::string GetHeaderPayload(size_t payload_size,
                               std::string fb_file_identifier);
  bool ReadExact(SocketUDS& socket,
                 char* buffer,
                 size_t size,
                 std::string& error_msg);
  bool WriteExact(SocketUDS& socket,
                  const char* data,
                  size_t size,
                  std::string& error_msg);

  std::string socket_path_;
  std::string label_;

  base::WeakPtrFactory<MLServerUDSV2> weak_ptr_factory_;
};

}  // namespace extensions

#endif  // EXTENSIONS_BROWSER_API_READ_SERVER_UDS_ML_SERVER_UDS_V2_H_
