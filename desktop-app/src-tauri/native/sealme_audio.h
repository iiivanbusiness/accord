#ifndef SEALME_AUDIO_H
#define SEALME_AUDIO_H

#include <stdint.h>
#include <stddef.h>

int32_t sealme_audio_start(void);
int32_t sealme_audio_is_capturing(void);
int32_t sealme_audio_stop_wav(uint8_t **out_ptr, size_t *out_len);
void sealme_audio_free(uint8_t *ptr, size_t len);

#endif
