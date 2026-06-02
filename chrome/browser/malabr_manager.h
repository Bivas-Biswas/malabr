#ifndef CHROME_BROWSER_MALABR_MANAGER_H_
#define CHROME_BROWSER_MALABR_MANAGER_H_

#include "base/feature_list.h"
#include "base/memory/ptr_util.h"
#include "base/process/process.h"
#include "content/public/common/content_features.h"

class MalabrManager {
 public:
  // Singleton instance getter
  static MalabrManager& GetInstance();

  // Start and stop ML server
  void StartMLServerIfEnabled();
  void StopMLServer();

 private:
  // Private constructor to enforce singleton
  MalabrManager();
  ~MalabrManager();

  base::Process mserver_uds_process_;

  // Prevent copying
  MalabrManager(const MalabrManager&) = delete;
  MalabrManager& operator=(const MalabrManager&) = delete;
};

#endif  // CHROME_BROWSER_MALABR_MANAGER_H_
