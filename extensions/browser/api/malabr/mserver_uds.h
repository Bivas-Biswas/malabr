#ifndef EXTENSIONS_BROWSER_API_READ_SERVER_UDS_MSERVER_UDS_H_
#define EXTENSIONS_BROWSER_API_READ_SERVER_UDS_MSERVER_UDS_H_

#include <memory>
#include <string>

#include "base/memory/weak_ptr.h"
#include "extensions/browser/api/malabr/msocket_uds.h"
#include "net/base/io_buffer.h"

namespace extensions {

class MServerUDS {
 public:
  MServerUDS(const std::string& socket_path, const std::string& label, const std::string& extension_id);
  ~MServerUDS();

  int Send(const char* payload,
           const size_t payload_size,
           std::string& response,
           std::string& error_msg);

  void Clear();

 private:
  std::string GetHeaderPayload(size_t payload_size);
  bool ReadExact(MSocketUDS& socket,
                 char* buffer,
                 size_t size,
                 std::string& error_msg);
  bool WriteExact(MSocketUDS& socket,
                  const char* data,
                  size_t size,
                  std::string& error_msg);

  std::string socket_path_;
  std::string route_;
  std::string extension_id_;

  base::WeakPtrFactory<MServerUDS> weak_ptr_factory_;
};

}  // namespace extensions

#endif  // EXTENSIONS_BROWSER_API_READ_SERVER_UDS_MSERVER_UDS_H_
