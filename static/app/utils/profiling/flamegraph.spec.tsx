import {collapseSystemFrameStrategy} from 'sentry/utils/profiling/collapseSystemFrameStrategy';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {EventedProfile} from 'sentry/utils/profiling/profile/eventedProfile';
import {SampledProfile} from 'sentry/utils/profiling/profile/sampledProfile';
import {createFrameIndex} from 'sentry/utils/profiling/profile/utils';
import {Rect} from 'sentry/utils/profiling/speedscope';

const makeEmptyEventedTrace = (type?: 'flamegraph' | 'flamechart'): EventedProfile => {
  return EventedProfile.FromProfile(
    {
      name: 'profile',
      startValue: 0,
      endValue: 0,
      unit: 'microseconds',
      type: 'evented',
      threadID: 0,
      events: [],
    },
    createFrameIndex('mobile', []),
    {type: type ?? 'flamechart'}
  );
};

describe('flamegraph', () => {
  it('throws if we are trying to construct call order flamegraph', () => {
    expect(() => {
      return new Flamegraph(makeEmptyEventedTrace('flamegraph'), 0, {
        inverted: false,
        sort: 'call order',
      });
    }).toThrow();
  });
  it('throws if we are trying to construct alphabetic order flamechart', () => {
    expect(() => {
      return new Flamegraph(makeEmptyEventedTrace('flamechart'), 0, {
        inverted: false,
        sort: 'alphabetical',
      });
    }).toThrow();
  });
  it('sets default timeline for empty flamegraph', () => {
    const flamegraph = new Flamegraph(makeEmptyEventedTrace(), 0, {
      inverted: false,
      sort: 'call order',
    });

    expect(flamegraph.configSpace.equals(new Rect(0, 0, 1_000_000, 0))).toBe(true);
    expect(flamegraph.inverted).toBe(false);
    expect(flamegraph.sort).toBe('call order');
  });

  it('initializes formatter', () => {
    const trace: Profiling.EventedProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      threadID: 0,
      type: 'evented',
      events: [
        {type: 'O', at: 0, frame: 0},
        {type: 'O', at: 500, frame: 1},
        {type: 'C', at: 600, frame: 1},
        {type: 'C', at: 1000, frame: 0},
      ],
    };

    const flamegraph = new Flamegraph(
      EventedProfile.FromProfile(
        trace,
        createFrameIndex('mobile', [{name: 'f0'}, {name: 'f1'}]),
        {type: 'flamechart'}
      ),
      10,
      {
        inverted: true,
        sort: 'left heavy',
      }
    );
    expect(flamegraph.formatter(1000)).toBe('1.00s');
    expect(flamegraph.formatter(500)).toBe('500.00ms');
  });

  it('stores profile properties', () => {
    const trace: Profiling.EventedProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      threadID: 0,
      type: 'evented',
      events: [
        {type: 'O', at: 0, frame: 0},
        {type: 'O', at: 1, frame: 1},
        {type: 'C', at: 2, frame: 1},
        {type: 'C', at: 3, frame: 0},
      ],
    };

    const flamegraph = new Flamegraph(
      EventedProfile.FromProfile(
        trace,
        createFrameIndex('mobile', [{name: 'f0'}, {name: 'f1'}]),
        {type: 'flamechart'}
      ),
      10,
      {
        inverted: true,
        sort: 'left heavy',
      }
    );

    expect(flamegraph.inverted).toBe(true);
    expect(flamegraph.sort).toBe('left heavy');
    expect(flamegraph.profileIndex).toBe(10);
  });

  it('creates a call order graph', () => {
    const trace: Profiling.EventedProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      threadID: 0,
      type: 'evented',
      events: [
        {type: 'O', at: 0, frame: 0},
        {type: 'O', at: 1, frame: 1},
        {type: 'O', at: 2, frame: 2},
        {type: 'C', at: 3, frame: 2},
        {type: 'C', at: 4, frame: 1},
        {type: 'C', at: 5, frame: 0},
      ],
    };

    const flamegraph = new Flamegraph(
      EventedProfile.FromProfile(
        trace,
        createFrameIndex('mobile', [{name: 'f0'}, {name: 'f1'}, {name: 'f2'}]),
        {type: 'flamechart'}
      ),
      10,
      {
        inverted: false,
        sort: 'call order',
      }
    );

    const order = ['f0', 'f1', 'f2'].reverse();
    for (let i = 0; i < order.length; i++) {
      expect(flamegraph.frames[i].frame.name).toBe(order[i]);
      expect(flamegraph.frames[i].depth).toBe(order.length - i - 1);
    }
  });

  it('omits 0 width frames', () => {
    const trace: Profiling.EventedProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      threadID: 0,
      type: 'evented',
      events: [
        {type: 'O', at: 0, frame: 0},
        {type: 'O', at: 1, frame: 1},
        {type: 'C', at: 1, frame: 1},
        {type: 'C', at: 3, frame: 0},
      ],
    };

    const flamegraph = new Flamegraph(
      EventedProfile.FromProfile(
        trace,
        createFrameIndex('mobile', [{name: 'f0'}, {name: 'f1'}]),
        {type: 'flamechart'}
      ),
      10,
      {
        inverted: false,
        sort: 'call order',
      }
    );
    expect(flamegraph.frames.length).toBe(1);
    expect(flamegraph.frames.every(f => f.frame.name !== 'f1')).toBe(true);
  });

  it('tracks max stack depth', () => {
    const trace: Profiling.EventedProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      threadID: 0,
      type: 'evented',
      events: [
        {type: 'O', at: 0, frame: 0},
        {type: 'O', at: 1, frame: 1},
        {type: 'O', at: 2, frame: 1},
        {type: 'C', at: 3, frame: 1},
        {type: 'C', at: 4, frame: 1},
        {type: 'C', at: 5, frame: 0},
      ],
    };

    const flamegraph = new Flamegraph(
      EventedProfile.FromProfile(
        trace,
        createFrameIndex('mobile', [{name: 'f0'}, {name: 'f1'}]),
        {type: 'flamechart'}
      ),
      10,
      {
        inverted: false,
        sort: 'call order',
      }
    );

    expect(flamegraph.depth).toBe(2);
  });

  it('throws on unbalanced stack', () => {
    const trace: Profiling.EventedProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      threadID: 0,
      type: 'evented',
      events: [
        {type: 'O', at: 0, frame: 0},
        {type: 'O', at: 1, frame: 1},
        {type: 'C', at: 1, frame: 1},
      ],
    };

    expect(
      () =>
        new Flamegraph(
          EventedProfile.FromProfile(
            trace,
            createFrameIndex('mobile', [{name: 'f0'}, {name: 'f1'}]),
            {type: 'flamechart'}
          ),
          10,
          {
            inverted: false,
            sort: 'call order',
          }
        )
    ).toThrow('Unbalanced append order stack');
  });

  it('creates left heavy graph', () => {
    const trace: Profiling.EventedProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      threadID: 0,
      type: 'evented',
      events: [
        {type: 'O', at: 0, frame: 0},
        {type: 'C', at: 1, frame: 0},
        {type: 'O', at: 2, frame: 1},
        {type: 'C', at: 4, frame: 1},
      ],
    };

    const flamegraph = new Flamegraph(
      EventedProfile.FromProfile(
        trace,
        createFrameIndex('mobile', [{name: 'f0'}, {name: 'f1'}]),
        {type: 'flamechart'}
      ),
      10,
      {
        inverted: false,
        sort: 'left heavy',
      }
    );

    expect(flamegraph.frames[1].frame.name).toBe('f0');
    expect(flamegraph.frames[1].frame.totalWeight).toBe(1);
    expect(flamegraph.frames[1].start).toBe(2);
    expect(flamegraph.frames[1].end).toBe(3);

    expect(flamegraph.frames[0].frame.name).toBe('f1');
    expect(flamegraph.frames[0].frame.totalWeight).toBe(2);
    expect(flamegraph.frames[0].start).toBe(0);
    expect(flamegraph.frames[0].end).toBe(2);
  });

  it('updates startTime and endTime of left heavy children graph', () => {
    const trace: Profiling.EventedProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      threadID: 0,
      type: 'evented',
      events: [
        {type: 'O', at: 0, frame: 0},
        {type: 'O', at: 1, frame: 1},
        {type: 'C', at: 2, frame: 1},
        {type: 'O', at: 2, frame: 2},
        {type: 'C', at: 4, frame: 2},
        {type: 'C', at: 6, frame: 0},
      ],
    };

    const flamegraph = new Flamegraph(
      EventedProfile.FromProfile(
        trace,
        createFrameIndex('mobile', [{name: 'f0'}, {name: 'f1'}, {name: 'f2'}]),
        {type: 'flamechart'}
      ),
      10,
      {
        inverted: false,
        sort: 'left heavy',
      }
    );

    expect(flamegraph.frames[2].frame.name).toBe('f0');
  });

  it('From', () => {
    const trace: Profiling.EventedProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      threadID: 0,
      type: 'evented',
      events: [
        {type: 'O', at: 0, frame: 0},
        {type: 'O', at: 1, frame: 1},
        {type: 'C', at: 2, frame: 1},
        {type: 'O', at: 2, frame: 2},
        {type: 'C', at: 4, frame: 2},
        {type: 'C', at: 6, frame: 0},
      ],
    };

    const flamegraph = new Flamegraph(
      EventedProfile.FromProfile(
        trace,
        createFrameIndex('mobile', [{name: 'f0'}, {name: 'f1'}, {name: 'f2'}]),
        {type: 'flamechart'}
      ),
      10,
      {
        inverted: false,
        sort: 'left heavy',
      }
    );

    expect(
      Flamegraph.From(flamegraph, {
        inverted: false,
        sort: 'call order',
      }).configSpace.equals(flamegraph.configSpace)
    ).toBe(true);
  });

  it('Empty', () => {
    expect(Flamegraph.Empty().configSpace.equals(new Rect(0, 0, 1_000, 0))).toBe(true);
  });

  it('collapseSystemFrames', () => {
    const trace: Profiling.SampledProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      threadID: 0,
      type: 'sampled',
      weights: [1, 1, 1],
      samples: [
        [0, 1, 2, 2, 3], // -> 0,1,3
        [0, 2, 2, 1, 2, 3], // ->  0,2,1,3
        [0, 3, 4, 1], // -> 0,4,1
      ],
    };

    const flamegraph = new Flamegraph(
      SampledProfile.FromProfile(
        trace,
        createFrameIndex('mobile', [
          {
            name: 'f0',
          },
          {name: 'f1', is_application: true},
          {name: 'f2'},
          {name: 'f3'},
          {name: 'f4'},
        ]),
        {
          type: 'flamegraph',
        }
      ),
      0,
      {
        sort: 'alphabetical',
        collapseStrategy: collapseSystemFrameStrategy,
      }
    );

    expect(flamegraph.root).toMatchObject(
      expectFrame('sentry root', {
        children: [
          expectFrame('f0', {
            children: [
              expectFrame('f1', {
                children: [
                  expectFrame('f3', {
                    collapsed: [expectFrame('f2'), expectFrame('f2')],
                  }),
                ],
              }),
              expectFrame('f2', {
                collapsed: [expectFrame('f2')],
                children: [
                  expectFrame('f1', {
                    children: [
                      expectFrame('f3', {
                        collapsed: [expectFrame('f2')],
                      }),
                    ],
                  }),
                ],
              }),
              expectFrame('f4', {
                collapsed: [expectFrame('f3')],
              }),
            ],
          }),
        ],
      })
    );
  });
});

function expectFrame(
  name: string,
  {
    collapsed,
    children,
  }: {
    children?: any[];
    collapsed?: any[];
  } = {}
) {
  const frame = {
    frame: expect.objectContaining({
      name,
    }),
    children: children ? expect.arrayContaining(children) : expect.any(Array),
  };
  if (collapsed) {
    // @ts-ignore
    frame.collapsed = expect.arrayContaining(collapsed);
  }
  return expect.objectContaining(frame);
}
