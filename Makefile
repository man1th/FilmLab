CC     = clang
CFLAGS = -O2 -Wall -std=c99
LFLAGS = -lm
TARGET = filmlab

SRCS = src/main.c \
       src/processor.c \
       src/pipeline/tone_curves.c \
       src/pipeline/color_matrix.c \
       src/pipeline/halation.c \
       src/pipeline/grain.c \
       src/stocks/cinestill_800t.c

OBJS = $(SRCS:.c=.o)

$(TARGET): $(OBJS)
	$(CC) $(CFLAGS) -o $(TARGET) $(OBJS) $(LFLAGS)

%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@

clean:
	find src -name "*.o" -delete
	rm -f $(TARGET)

.PHONY: clean
